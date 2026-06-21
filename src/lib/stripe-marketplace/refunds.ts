import type Stripe from "stripe";

import { audit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { sendRefundNotice } from "@/lib/email/send";
import { markPurchaseRefunded } from "@/lib/payments/settlement";
import { markTicketRefunded } from "@/lib/tickets/lifecycle";
import { stripeClient } from "./client";
import { WebhookSignatureError } from "./errors";
import type { MarketplacePaymentRow } from "./payments";
import { transitionPayment } from "./state-machine";
import { upsertSellerAccount } from "./seller-accounts";
import {
  listTransfersForPayment,
  type MarketplaceTransferRow,
  type TransferRecipientRole,
} from "./transfers";
import { reverseTransfer } from "./transfers";

// Admin-only manual refund. The Marketplace fee is NEVER refunded to
// the buyer (plan rule). Refundable seller proceeds are reversed from
// the connected accounts first using a prorate-min allocation so a
// partial refund never over-claws sellers. If a reversal fails Stripe-
// side, the seller is flagged `owes_recovery` and the buyer refund
// still proceeds.

export interface ManualRefundInput {
  payment: MarketplacePaymentRow;
  // Optional partial refund expressed in cents; defaults to the full
  // refundable amount (gross - marketplace_fee).
  refundCents?: number;
}

export interface ManualRefundResult {
  refundId: string;
  refundCents: number;
  reversedTransferIds: string[];
}

export async function manuallyRefundPayment(
  input: ManualRefundInput,
): Promise<ManualRefundResult> {
  const payment = input.payment;
  if (!payment.stripe_payment_intent_id) {
    throw new Error("payment has no stripe_payment_intent_id");
  }
  if (!payment.stripe_charge_id) {
    throw new Error("payment has no stripe_charge_id");
  }

  const maxRefundable = refundableSellerShare(payment);
  const refundCents = Math.min(
    input.refundCents ?? maxRefundable,
    maxRefundable,
  );
  if (refundCents <= 0) {
    throw new Error("Refundable amount is zero");
  }

  await transitionPayment(payment.id, { type: "REFUND_PENDING" });

  if (refundCents >= maxRefundable) {
    await assertFullRefundLifecycleCanFinalize(payment);
  }

  const reversedTransferIds = await proRateReversals({
    payment,
    targetSellerShareCents: refundCents,
    auditActor: payment.buyer_user_id,
    refundKey: `manual_${payment.id}_${refundCents}`,
  });

  // Issue Stripe refund AT the charge level. `reverse_transfer:false`
  // because we already reversed manually above. `refund_application_fee:
  // false` because the marketplace fee is excluded by `amount` itself.
  const stripe = stripeClient();
  const refund = await stripe.refunds.create(
    {
      charge: payment.stripe_charge_id,
      amount: refundCents,
      reverse_transfer: false,
      refund_application_fee: false,
      metadata: { marketplace_payment_id: payment.id },
    },
    { idempotencyKey: `refund_${payment.id}_${refundCents}` },
  );

  await transitionPayment(payment.id, { type: "REFUNDED" });
  if (refundCents >= maxRefundable) {
    await finalizeFullRefundLifecycle(payment);
  }

  await audit({
    actorUserId: payment.buyer_user_id,
    action: "marketplace.refund.manual",
    entityType: "marketplace_payment",
    entityId: payment.id,
    metadata: {
      refund_id: refund.id,
      refund_cents: refundCents,
      reversed_transfer_ids: reversedTransferIds,
    },
  });

  await notifyRefund(payment, refundCents, "Refund processed by Miso support.");

  return {
    refundId: refund.id,
    refundCents,
    reversedTransferIds,
  };
}

// Stripe-initiated refunds (admin dashboard, dispute outcomes, direct
// API call). We previously only marked the row refunded without
// reversing the seller transfers — sellers were getting paid AND the
// buyer was getting refunded. Now we run the same prorate-min reversal
// and only terminalize when the cumulative refund covers the
// non-fee portion of the payment.
export async function recordExternalChargeRefund(input: {
  payment: MarketplacePaymentRow;
  refund: Stripe.Refund;
  cumulativeRefundedCents?: number;
}): Promise<void> {
  const { payment, refund } = input;
  const refundAmountCents = refund.amount ?? 0;
  const cumulativeRefundedCents =
    input.cumulativeRefundedCents ?? refundAmountCents;
  if (cumulativeRefundedCents <= 0) {
    return;
  }

  await transitionPayment(payment.id, { type: "REFUND_PENDING" });

  const maxRefundable = refundableSellerShare(payment);
  const sellerShare = Math.max(
    0,
    Math.min(cumulativeRefundedCents, maxRefundable),
  );

  let reversedTransferIds: string[] = [];
  if (sellerShare > 0) {
    reversedTransferIds = await proRateReversals({
      payment,
      targetSellerShareCents: sellerShare,
      auditActor: payment.buyer_user_id,
      refundKey: refund.id,
    });
  }

  const fullyRefunded = cumulativeRefundedCents >= maxRefundable;
  await transitionPayment(payment.id, {
    type: fullyRefunded ? "REFUNDED" : "REFUND_PENDING",
  });
  if (fullyRefunded) {
    await finalizeFullRefundLifecycle(payment);
  }

  await audit({
    actorUserId: payment.buyer_user_id,
    action: "marketplace.refund.external",
    entityType: "marketplace_payment",
    entityId: payment.id,
    metadata: {
      stripe_refund_id: refund.id,
      stripe_refund_amount_cents: refundAmountCents,
      stripe_cumulative_refunded_cents: cumulativeRefundedCents,
      seller_share_cents: sellerShare,
      fully_refunded: fullyRefunded,
      reversed_transfer_ids: reversedTransferIds,
    },
  });

  await notifyRefund(payment, refundAmountCents, refund.reason ?? null);
}

function refundableSellerShare(payment: MarketplacePaymentRow): number {
  return payment.amount_total_cents - payment.marketplace_fee_cents;
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Best-effort refund email. Fully internally caught — never throws — so it
// cannot affect the refund result already committed by the caller.
async function notifyRefund(
  payment: MarketplacePaymentRow,
  refundCents: number,
  reason: string | null,
): Promise<void> {
  try {
    const sb = createServiceClient();
    let ticketId: string | undefined;
    if (payment.purchase_id) {
      const { data: purchase } = await sb
        .from("purchases")
        .select("ticket_id")
        .eq("id", payment.purchase_id)
        .maybeSingle<{ ticket_id: string }>();
      ticketId = purchase?.ticket_id;
    } else if (payment.resale_listing_id) {
      const { data: listing } = await sb
        .from("resale_listings")
        .select("ticket_id")
        .eq("id", payment.resale_listing_id)
        .maybeSingle<{ ticket_id: string }>();
      ticketId = listing?.ticket_id;
    } else {
      const { data: item } = await sb
        .from("marketplace_payment_items")
        .select("purchases(ticket_id)")
        .eq("marketplace_payment_id", payment.id)
        .limit(1)
        .maybeSingle<{ purchases: { ticket_id: string } | null }>();
      ticketId = item?.purchases?.ticket_id;
    }

    let eventName = "your event";
    if (ticketId) {
      const { data: ticket } = await sb
        .from("tickets")
        .select("event_id")
        .eq("id", ticketId)
        .maybeSingle<{ event_id: string }>();
      if (ticket?.event_id) {
        const { data: event } = await sb
          .from("events")
          .select("name")
          .eq("id", ticket.event_id)
          .maybeSingle<{ name: string }>();
        eventName = event?.name ?? eventName;
      }
    }

    await sendRefundNotice({
      buyerUserId: payment.buyer_user_id,
      eventName,
      amount: formatEur(refundCents),
      reason,
    });
  } catch (err) {
    console.error("[email] refund notification failed", err);
  }
}

// Re-export so api routes import refund helpers from one file.
export { WebhookSignatureError };

interface RefundablePurchaseRow {
  id: string;
  ticket_id: string;
  status: string;
}

interface RefundableTicketRow {
  id: string;
  status: string;
}

const REFUND_FINALIZABLE_TICKET_STATUSES = new Set([
  "sold",
  "listed",
  "refund_pending",
  "repair_needed",
  "canceled",
  "available",
  "reserved",
  "expired",
  "refunded",
]);

function canFinalizeRefundTicket(status: string): boolean {
  return REFUND_FINALIZABLE_TICKET_STATUSES.has(status);
}

async function assertFullRefundLifecycleCanFinalize(
  payment: MarketplacePaymentRow,
): Promise<void> {
  const sb = createServiceClient();
  const tickets = await loadRefundLifecycleTickets(sb, payment);
  const blocked = tickets.find(
    (ticket) => !canFinalizeRefundTicket(ticket.status),
  );
  if (blocked) {
    throw new Error("Cannot refund this ticket in its current state");
  }
}

async function finalizeFullRefundLifecycle(
  payment: MarketplacePaymentRow,
): Promise<void> {
  const sb = createServiceClient();
  if (payment.kind === "primary") {
    const purchases = await loadRefundLifecyclePurchases(sb, payment);
    for (const purchase of purchases) {
      await refundLifecycleTicket(purchase.ticket_id);
      if (purchase.status !== "refunded") {
        await markPurchaseRefunded(purchase.id);
      }
    }
    return;
  }

  if (!payment.resale_listing_id) return;
  const { data: listing, error } = await sb
    .from("resale_listings")
    .select("id, ticket_id, status")
    .eq("id", payment.resale_listing_id)
    .maybeSingle<{ id: string; ticket_id: string; status: string }>();
  if (error) throw error;
  if (!listing) return;

  await refundLifecycleTicket(listing.ticket_id);
}

async function refundLifecycleTicket(ticketId: string): Promise<void> {
  const sb = createServiceClient();
  const { data: ticket, error } = await sb
    .from("tickets")
    .select("id, status")
    .eq("id", ticketId)
    .maybeSingle<RefundableTicketRow>();
  if (error) throw error;
  if (!ticket || ticket.status === "refunded") return;
  await markTicketRefunded(ticket.id);
}

async function loadRefundLifecyclePurchases(
  sb: ReturnType<typeof createServiceClient>,
  payment: MarketplacePaymentRow,
): Promise<RefundablePurchaseRow[]> {
  if (payment.purchase_id) {
    const { data, error } = await sb
      .from("purchases")
      .select("id, ticket_id, status")
      .eq("id", payment.purchase_id)
      .maybeSingle<RefundablePurchaseRow>();
    if (error) throw error;
    return data ? [data] : [];
  }

  const { data, error } = await sb
    .from("marketplace_payment_items")
    .select("purchases(id, ticket_id, status)")
    .eq("marketplace_payment_id", payment.id)
    .returns<Array<{ purchases: RefundablePurchaseRow | null }>>();
  if (error) throw error;
  return (data ?? []).flatMap((item) => item.purchases ?? []);
}

async function loadRefundLifecycleTickets(
  sb: ReturnType<typeof createServiceClient>,
  payment: MarketplacePaymentRow,
): Promise<RefundableTicketRow[]> {
  if (payment.kind === "primary") {
    const purchases = await loadRefundLifecyclePurchases(sb, payment);
    if (purchases.length === 0) return [];
    const { data, error } = await sb
      .from("tickets")
      .select("id, status")
      .in(
        "id",
        purchases.map((purchase) => purchase.ticket_id),
      )
      .returns<RefundableTicketRow[]>();
    if (error) throw error;
    return data ?? [];
  }

  if (!payment.resale_listing_id) return [];
  const { data: listing, error: listingError } = await sb
    .from("resale_listings")
    .select("ticket_id")
    .eq("id", payment.resale_listing_id)
    .maybeSingle<{ ticket_id: string }>();
  if (listingError) throw listingError;
  if (!listing) return [];
  const { data: ticket, error: ticketError } = await sb
    .from("tickets")
    .select("id, status")
    .eq("id", listing.ticket_id)
    .maybeSingle<RefundableTicketRow>();
  if (ticketError) throw ticketError;
  return ticket ? [ticket] : [];
}

// ---------------------------------------------------------------------------
// Shared helper: prorate-min reversal allocation.
//
// Allocates `refundCents` across the payment's created transfers using a
// `min(transfer.amount_cents, remainingToReverse)` greedy walk. Organizer
// royalty is clawed back BEFORE resale-seller proceeds because the
// royalty is closer to platform commission and is more often what an
// admin would want to reclaim first on a partial refund.
//
// Reversal failures are caught individually — the seller's risk status
// is bumped to `owes_recovery` so the platform can recover later. The
// outer caller still issues the buyer refund.
// ---------------------------------------------------------------------------
const ROLE_REVERSAL_PRIORITY: Record<TransferRecipientRole, number> = {
  organizer: 0,
  resale_seller: 1,
};

export interface ReversalStep {
  transferId: string;
  stripeTransferId: string;
  recipientUserId: string;
  recipientRole: TransferRecipientRole;
  stripeConnectedAccountId: string;
  amountCents: number;
}

// Pure: prorate-min allocation across created transfers. Organizer royalty is
// clawed back before resale-seller proceeds (closer to platform commission).
// No I/O — tested in __tests__/reversal-plan.test.ts.
export function planProRateReversals(
  transfers: MarketplaceTransferRow[],
  refundCents: number,
): ReversalStep[] {
  if (refundCents <= 0) return [];
  const candidates = transfers
    .filter(
      (t): t is MarketplaceTransferRow & { stripe_transfer_id: string } =>
        !!t.stripe_transfer_id &&
        (t.status === "created" || t.status === "reversed") &&
        remainingTransferCents(t) > 0,
    )
    .sort(
      (a, b) =>
        ROLE_REVERSAL_PRIORITY[a.recipient_role] -
        ROLE_REVERSAL_PRIORITY[b.recipient_role],
    );

  const steps: ReversalStep[] = [];
  let remaining = refundCents;
  for (const transfer of candidates) {
    if (remaining <= 0) break;
    const amount = Math.min(remainingTransferCents(transfer), remaining);
    if (amount <= 0) continue;
    steps.push({
      transferId: transfer.id,
      stripeTransferId: transfer.stripe_transfer_id,
      recipientUserId: transfer.recipient_user_id,
      recipientRole: transfer.recipient_role,
      stripeConnectedAccountId: transfer.stripe_connected_account_id,
      amountCents: amount,
    });
    remaining -= amount;
  }
  return steps;
}

function remainingTransferCents(transfer: MarketplaceTransferRow): number {
  return Math.max(
    0,
    transfer.amount_cents - (transfer.reversed_amount_cents ?? 0),
  );
}

function reversedSellerShareCents(transfers: MarketplaceTransferRow[]): number {
  return transfers.reduce(
    (total, transfer) => total + (transfer.reversed_amount_cents ?? 0),
    0,
  );
}

async function proRateReversals(input: {
  payment: MarketplacePaymentRow;
  targetSellerShareCents: number;
  auditActor: string;
  refundKey: string;
}): Promise<string[]> {
  const reversed: string[] = [];
  const transfers = await listTransfersForPayment(input.payment.id);
  const alreadyReversed = reversedSellerShareCents(transfers);
  const remainingTarget = Math.max(
    0,
    input.targetSellerShareCents - alreadyReversed,
  );
  const plan = planProRateReversals(transfers, remainingTarget);

  for (const step of plan) {
    try {
      const reversalId = await reverseTransfer({
        marketplaceTransferId: step.transferId,
        stripeTransferId: step.stripeTransferId,
        amountCents: step.amountCents,
        refundKey: input.refundKey,
      });
      reversed.push(reversalId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "reversal failed";
      await upsertSellerAccount({
        user_id: step.recipientUserId,
        stripe_account_id: step.stripeConnectedAccountId,
        seller_risk_status: "owes_recovery",
      });
      await audit({
        actorUserId: input.auditActor,
        action: "marketplace.transfer.reversal_failed",
        entityType: "marketplace_payment",
        entityId: input.payment.id,
        metadata: {
          recipient_role: step.recipientRole,
          recipient_user_id: step.recipientUserId,
          stripe_transfer_id: step.stripeTransferId,
          attempted_reverse_cents: step.amountCents,
          error: message,
        },
      });
    }
  }
  return reversed;
}
