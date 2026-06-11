import crypto from "node:crypto";

import { audit } from "@/lib/audit";
import { stripeClient } from "./client";
import { createServiceClient } from "@/lib/supabase/service";
import { getSellerAccountByUserId } from "./seller-accounts";
import type { MarketplacePaymentRow } from "./payments";

// Connected-account transfers (the "T" of separate charges and transfers).
// Called by the webhook AFTER ticket fulfillment confirms — never during
// the buyer HTTP request.
//
// Idempotency: every transfer carries a deterministic
// `idempotencyKey = sha256(marketplace_payment_id + recipient_role)` so
// retrying the webhook never double-pays a seller. Stripe itself also
// dedupes on the platform-side using `source_transaction` + amount.

function transferIdempotencyKey(
  marketplacePaymentId: string,
  role: "organizer" | "resale_seller",
): string {
  return crypto
    .createHash("sha256")
    .update(`${marketplacePaymentId}:${role}`)
    .digest("hex")
    .slice(0, 64);
}

export interface CreatedTransfersSummary {
  organizerTransferId?: string;
  resaleSellerTransferId?: string;
  organizerRoyaltyTransferId?: string;
}

export async function createTransfersForPayment(
  payment: MarketplacePaymentRow,
): Promise<CreatedTransfersSummary> {
  if (!payment.stripe_charge_id) {
    throw new Error(
      `marketplace_payment ${payment.id} has no charge id; cannot create transfers`,
    );
  }
  if (!payment.stripe_transfer_group) {
    throw new Error(
      `marketplace_payment ${payment.id} has no transfer_group; cannot create transfers`,
    );
  }

  const existing = await listTransfersForPayment(payment.id);
  const byRole = new Map(
    existing.map((row) => [row.recipient_role, row] as const),
  );
  const summary: CreatedTransfersSummary = {};

  if (payment.kind === "primary") {
    const tx = await ensureTransfer({
      payment,
      role: "organizer",
      recipientUserId: payment.primary_seller_user_id,
      amountCents: payment.primary_seller_cents,
      preexisting: byRole.get("organizer") ?? null,
    });
    summary.organizerTransferId = tx;
    return summary;
  }

  // Resale: pay the holder + (optional) organizer royalty.
  if (payment.primary_seller_cents > 0) {
    const tx = await ensureTransfer({
      payment,
      role: "resale_seller",
      recipientUserId: payment.primary_seller_user_id,
      amountCents: payment.primary_seller_cents,
      preexisting: byRole.get("resale_seller") ?? null,
    });
    summary.resaleSellerTransferId = tx;
  }
  if (payment.organizer_royalty_cents > 0 && payment.organizer_user_id) {
    const tx = await ensureTransfer({
      payment,
      role: "organizer",
      recipientUserId: payment.organizer_user_id,
      amountCents: payment.organizer_royalty_cents,
      preexisting: byRole.get("organizer") ?? null,
    });
    summary.organizerRoyaltyTransferId = tx;
  }
  return summary;
}

async function ensureTransfer(input: {
  payment: MarketplacePaymentRow;
  role: "organizer" | "resale_seller";
  recipientUserId: string;
  amountCents: number;
  preexisting:
    | Awaited<ReturnType<typeof listTransfersForPayment>>[number]
    | null;
}): Promise<string> {
  // Already created and recorded → idempotent short-circuit.
  if (
    input.preexisting &&
    input.preexisting.status === "created" &&
    input.preexisting.stripe_transfer_id
  ) {
    return input.preexisting.stripe_transfer_id;
  }

  const seller = await getSellerAccountByUserId(input.recipientUserId);
  if (!seller) {
    throw new Error(
      `Cannot create transfer: no Stripe Connect account for user ${input.recipientUserId}`,
    );
  }
  if (!seller.payouts_enabled || !seller.charges_enabled) {
    throw new Error(
      `Cannot create transfer: Stripe account ${seller.stripe_account_id} is not payout-ready`,
    );
  }

  // Pre-record the row so a Stripe-side success with a DB failure can be
  // recovered by retrying the same idempotency key.
  const row = await upsertTransferRow({
    marketplace_payment_id: input.payment.id,
    recipient_user_id: input.recipientUserId,
    recipient_role: input.role,
    amount_cents: input.amountCents,
    currency: "EUR",
    stripe_connected_account_id: seller.stripe_account_id,
    status: "pending",
  });

  try {
    const stripe = stripeClient();
    const transfer = await stripe.transfers.create(
      {
        amount: input.amountCents,
        currency: "eur",
        destination: seller.stripe_account_id,
        transfer_group: input.payment.stripe_transfer_group!,
        source_transaction: input.payment.stripe_charge_id!,
        metadata: {
          marketplace_payment_id: input.payment.id,
          recipient_role: input.role,
          recipient_user_id: input.recipientUserId,
        },
      },
      {
        idempotencyKey: transferIdempotencyKey(input.payment.id, input.role),
      },
    );

    await updateTransferRow(row.id, {
      status: "created",
      stripe_transfer_id: transfer.id,
    });

    await audit({
      actorUserId: input.recipientUserId,
      action: "marketplace.transfer.created",
      entityType: "marketplace_payment",
      entityId: input.payment.id,
      metadata: {
        recipient_role: input.role,
        recipient_user_id: input.recipientUserId,
        stripe_transfer_id: transfer.id,
        amount_cents: input.amountCents,
      },
    });

    return transfer.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "transfer failed";
    await updateTransferRow(row.id, {
      status: "failed",
      failure_reason: message,
    });
    throw err;
  }
}

// Reverses a single connected-account transfer. Used by refunds when
// seller proceeds are being clawed back. If the connected account no
// longer has funds, Stripe surfaces an error and the caller decides
// whether to flip seller_risk_status to `owes_recovery`.
export async function reverseTransfer(input: {
  marketplaceTransferId: string;
  stripeTransferId: string;
  amountCents?: number;
}): Promise<string> {
  const stripe = stripeClient();
  const reversal = await stripe.transfers.createReversal(
    input.stripeTransferId,
    {
      ...(input.amountCents ? { amount: input.amountCents } : {}),
    },
    {
      idempotencyKey: `rev_${input.marketplaceTransferId}`,
    },
  );
  await updateTransferRow(input.marketplaceTransferId, {
    status: "reversed",
    stripe_transfer_reversal_id: reversal.id,
  });
  return reversal.id;
}

export type TransferRecipientRole = "organizer" | "resale_seller";

export type TransferStatus = "pending" | "created" | "reversed" | "failed";

export interface MarketplaceTransferRow {
  id: string;
  marketplace_payment_id: string;
  recipient_user_id: string;
  recipient_role: TransferRecipientRole;
  amount_cents: number;
  currency: "EUR";
  stripe_connected_account_id: string;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  status: TransferStatus;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTransfersForPayment(
  marketplacePaymentId: string,
): Promise<MarketplaceTransferRow[]> {
  const TRANSFER_TABLE = "marketplace_transfers" as const;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(TRANSFER_TABLE)
    .select("*")
    .eq("marketplace_payment_id", marketplacePaymentId);
  if (error) throw error;
  return (data ?? []) as MarketplaceTransferRow[];
}

export async function upsertTransferRow(input: {
  marketplace_payment_id: string;
  recipient_user_id: string;
  recipient_role: TransferRecipientRole;
  amount_cents: number;
  currency: "EUR";
  stripe_connected_account_id: string;
  stripe_transfer_id?: string | null;
  status?: TransferStatus;
  failure_reason?: string | null;
}): Promise<MarketplaceTransferRow> {
  const TRANSFER_TABLE = "marketplace_transfers" as const;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(TRANSFER_TABLE)
    .upsert(input, {
      onConflict: "marketplace_payment_id,recipient_role",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketplaceTransferRow;
}

export async function updateTransferRow(
  id: string,
  patch: Partial<
    Pick<
      MarketplaceTransferRow,
      | "status"
      | "stripe_transfer_id"
      | "stripe_transfer_reversal_id"
      | "failure_reason"
    >
  >,
): Promise<MarketplaceTransferRow> {
  const TRANSFER_TABLE = "marketplace_transfers" as const;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(TRANSFER_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketplaceTransferRow;
}
