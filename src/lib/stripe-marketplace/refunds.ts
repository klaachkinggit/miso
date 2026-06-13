import type Stripe from "stripe";

import { audit } from "@/lib/audit";
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

  const maxRefundable =
    payment.amount_total_cents - payment.marketplace_fee_cents;
  const refundCents = Math.min(
    input.refundCents ?? maxRefundable,
    maxRefundable,
  );
  if (refundCents <= 0) {
    throw new Error("Refundable amount is zero");
  }

  await transitionPayment(payment.id, { type: "REFUND_PENDING" });

  const reversedTransferIds = await proRateReversals({
    payment,
    refundCents,
    auditActor: payment.buyer_user_id,
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
}): Promise<void> {
  const { payment, refund } = input;
  const refundAmountCents = refund.amount ?? 0;
  if (refundAmountCents <= 0) {
    // Status untouched, but could touch last_webhook_at.
    return;
  }

  await transitionPayment(payment.id, { type: "REFUND_PENDING" });

  // Cap reversal at the seller-proceeds portion of the refund. The
  // marketplace fee is non-refundable so any refund amount up to
  // marketplace_fee_cents claws back zero from sellers; anything above
  // that prorates against connected-account transfers.
  const sellerShare = Math.max(
    0,
    Math.min(
      refundAmountCents,
      payment.amount_total_cents - payment.marketplace_fee_cents,
    ),
  );

  let reversedTransferIds: string[] = [];
  if (sellerShare > 0) {
    reversedTransferIds = await proRateReversals({
      payment,
      refundCents: sellerShare,
      auditActor: payment.buyer_user_id,
    });
  }

  // Only mark fully `refunded` when the cumulative refund covers the
  // entire refundable (non-fee) portion. Otherwise stay
  // `refund_pending` so admin sees partial state.
  const fullyRefunded =
    refundAmountCents >=
    payment.amount_total_cents - payment.marketplace_fee_cents;
  await transitionPayment(payment.id, { type: fullyRefunded ? "REFUNDED" : "REFUND_PENDING" });

  await audit({
    actorUserId: payment.buyer_user_id,
    action: "marketplace.refund.external",
    entityType: "marketplace_payment",
    entityId: payment.id,
    metadata: {
      stripe_refund_id: refund.id,
      stripe_refund_amount_cents: refundAmountCents,
      seller_share_cents: sellerShare,
      fully_refunded: fullyRefunded,
      reversed_transfer_ids: reversedTransferIds,
    },
  });
}

// Re-export so api routes import refund helpers from one file.
export { WebhookSignatureError };

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
        !!t.stripe_transfer_id && t.status === "created",
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
    const amount = Math.min(transfer.amount_cents, remaining);
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

async function proRateReversals(input: {
  payment: MarketplacePaymentRow;
  refundCents: number;
  auditActor: string;
}): Promise<string[]> {
  const reversed: string[] = [];
  const transfers = await listTransfersForPayment(input.payment.id);
  const plan = planProRateReversals(transfers, input.refundCents);

  for (const step of plan) {
    try {
      const reversalId = await reverseTransfer({
        marketplaceTransferId: step.transferId,
        stripeTransferId: step.stripeTransferId,
        amountCents: step.amountCents,
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
