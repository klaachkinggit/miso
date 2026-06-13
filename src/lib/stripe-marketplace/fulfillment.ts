import { audit } from "@/lib/audit";
import { ChainOpInFlightError, ChainOpRepairError } from "@/lib/chain/ops";
import { fulfillReservedTicket } from "@/lib/tickets/lifecycle";
import {
  fulfillResale,
  ResaleTransferPendingError,
} from "@/lib/resale/listing";
import { TransactionTimeoutError } from "@/lib/thirdweb/transactions";
import { createServiceClient } from "@/lib/supabase/service";

import {
  getMarketplacePaymentByIntent,
  type MarketplacePaymentRow,
} from "./payments";
import { createTransfersForPayment } from "./transfers";
import { transitionPayment } from "./state-machine";

// Bridges Stripe payment success to ticket fulfillment + seller
// transfers.
//
// Order, per plan:
//   1. fulfillment (mint for primary, adminTransfer for resale)
//   2. ONLY if fulfillment succeeded → create connected-account transfers
//   3. mark marketplace_payment + purchase/listing as paid
//
// If fulfillment is uncertain (chain timeout / in-flight / repair) the
// payment stays in `fulfillment_pending` (or `repair_needed` for admin
// view) and NO transfers are created — funds sit on the platform.

// Settlement lease window. A claimed payment whose `last_webhook_at`
// is older than this is considered orphaned (its prior runner crashed)
// and may be re-claimed by the next Stripe retry. Tuned to be larger
// than the worst-case chain mint timeout (~30s) plus headroom.
const SETTLEMENT_LEASE_MS = 5 * 60 * 1000;

// Terminal-error patterns: definitive "cannot fulfill" outcomes that
// no amount of webhook retry will resolve. Match by message substring
// because the upstream helpers throw plain Error in these cases.
const TERMINAL_FULFILLMENT_PATTERNS = [
  /missing purchase_id/i,
  /missing listing_id/i,
  /purchase .* missing/i,
  /Event (canceled|has been canceled|already passed)/i,
  /Event missing/i,
  /Event has no organizer/i,
  /Event has no deployed contract/i,
  /Ticket missing/i,
  /Listing not found/i,
  /Listing not active/i,
  /Listing disappeared/i,
  /Cannot buy your own listing/i,
  /Ticket has no on-chain identity/i,
  /Seller smart account missing/i,
  /Ticket no longer listable/i,
  /Ticket not in a transferable state/i,
  /Ticket cannot be transferred/i,
];

function isTerminalFulfillmentError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  return TERMINAL_FULFILLMENT_PATTERNS.some((p) => p.test(msg));
}

function isPendingFulfillmentError(err: unknown): boolean {
  if (err instanceof TransactionTimeoutError) return true;
  if (err instanceof ChainOpInFlightError) return true;
  if (err instanceof ChainOpRepairError) return true;
  if (err instanceof ResaleTransferPendingError) return true;
  if (err instanceof Error) {
    return (
      err.name === "TransactionTimeoutError" ||
      err.name === "ChainOpInFlightError" ||
      err.name === "ChainOpRepairError" ||
      err.name === "ResaleTransferPendingError"
    );
  }
  return false;
}

export async function settleSucceededPaymentIntent(input: {
  paymentIntentId: string;
  chargeId: string;
}): Promise<MarketplacePaymentRow> {
  const sb = createServiceClient();
  const payment = await getMarketplacePaymentByIntent(input.paymentIntentId);
  if (!payment) {
    throw new Error(
      `No marketplace_payment for payment_intent ${input.paymentIntentId}`,
    );
  }

  // Idempotent re-entry: already fully settled.
  if (payment.status === "paid") return payment;

  // Settlement lease. The claim transitions the row into `succeeded`
  // and stamps `last_webhook_at`. A concurrent webhook gets blocked
  // by the WHERE predicate; a CRASHED prior runner is recovered when
  // a later Stripe retry arrives more than SETTLEMENT_LEASE_MS after
  // the stamp — the `succeeded` row is then re-claimable.
  //
  // The combination handles both:
  //   * concurrent delivery → only one runner advances
  //   * crash-after-claim    → next retry takes over within the lease window
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiry = new Date(
    now.getTime() - SETTLEMENT_LEASE_MS,
  ).toISOString();
  const { data: claimed, error: claimErr } = await sb
    .from("marketplace_payments")
    .update({
      stripe_charge_id: input.chargeId,
      succeeded_at: payment.succeeded_at ?? nowIso,
      last_webhook_at: nowIso,
      status: "succeeded",
    })
    .eq("id", payment.id)
    .or(
      // Either still pre-settlement, OR a prior settler stamped a
      // `succeeded`/in-flight status but its lease has expired.
      `and(status.in.(requires_payment,processing)),and(status.in.(succeeded,fulfillment_pending,transfers_pending,repair_needed),or(last_webhook_at.is.null,last_webhook_at.lt.${leaseExpiry})),and(status.eq.succeeded,last_webhook_at.eq.${nowIso})`,
    )
    .select("*")
    .maybeSingle<MarketplacePaymentRow>();
  if (claimErr) throw claimErr;
  if (!claimed) {
    // Either: (a) another runner holds the lease — idempotently
    // return the live row; (b) terminal (paid/failed/refunded) — same.
    const fresh = await getMarketplacePaymentByIntent(input.paymentIntentId);
    if (fresh) return fresh;
    throw new Error(
      `marketplace_payment ${payment.id} disappeared during claim`,
    );
  }
  const stamped = claimed;

  // --- 1. Fulfill on chain --------------------------------------------------
  try {
    if (stamped.kind === "primary") {
      if (!stamped.purchase_id) {
        throw new Error(`primary payment ${stamped.id} missing purchase_id`);
      }
      const { data: purchase } = await sb
        .from("purchases")
        .select("ticket_id, buyer_user_id, status")
        .eq("id", stamped.purchase_id)
        .single<{ ticket_id: string; buyer_user_id: string; status: string }>();
      if (!purchase) throw new Error(`purchase ${stamped.purchase_id} missing`);
      await fulfillReservedTicket({
        ticketId: purchase.ticket_id,
        buyerUserId: purchase.buyer_user_id,
        purchaseId: stamped.purchase_id,
      });
    } else {
      if (!stamped.resale_listing_id) {
        throw new Error(`resale payment ${stamped.id} missing listing_id`);
      }
      await fulfillResale({
        listingId: stamped.resale_listing_id,
        buyerUserId: stamped.buyer_user_id,
        paymentMode: "stripe",
      });
    }
  } catch (err) {
    const pending = isPendingFulfillmentError(err);
    const isRepair =
      err instanceof ChainOpRepairError ||
      (err instanceof Error && err.name === "ChainOpRepairError");
    const terminal = !pending && !isRepair && isTerminalFulfillmentError(err);

    await transitionPayment(payment.id, {
      type:
        isRepair || terminal ? "FULFILLMENT_TERMINAL" : "FULFILLMENT_PENDING",
      reason: err instanceof Error ? err.message : "fulfillment failed",
    });

    await audit({
      actorUserId: stamped.buyer_user_id,
      action: terminal
        ? "marketplace.fulfillment_terminal"
        : "marketplace.fulfillment_pending",
      entityType: "marketplace_payment",
      entityId: stamped.id,
      metadata: {
        kind: stamped.kind,
        reason: err instanceof Error ? err.message : "unknown",
        state: isRepair
          ? "repair_needed"
          : terminal
            ? "terminal_admin_refund_required"
            : pending
              ? "in_flight"
              : "failed",
      },
    });

    if (pending || isRepair || terminal) return stamped;
    throw err;
  }

  // --- 2. Mark fulfilled, then create transfers ----------------------------
  const fulfilled = await transitionPayment(payment.id, {
    type: "TRANSFERS_PENDING",
  });

  try {
    await createTransfersForPayment(fulfilled);
  } catch (err) {
    await transitionPayment(payment.id, {
      type: "TRANSFERS_FAILED",
      reason: err instanceof Error ? err.message : "transfer failed",
    });
    throw err;
  }

  // --- 3. Mark paid + sync legacy purchases row -----------------------------
  const paid = await transitionPayment(payment.id, { type: "PAID" });
  return paid;
}

export async function settleFailedPaymentIntent(input: {
  paymentIntentId: string;
  failureMessage?: string;
}): Promise<MarketplacePaymentRow | null> {
  const payment = await getMarketplacePaymentByIntent(input.paymentIntentId);
  if (!payment) return null;
  if (payment.status === "paid") return payment;

  return transitionPayment(payment.id, {
    type: "WEBHOOK_FAILED_ATTEMPT",
    reason: input.failureMessage ?? "payment_intent.payment_failed (attempt)",
  });
}

export async function settleCanceledPaymentIntent(input: {
  paymentIntentId: string;
  cancellationReason?: string;
}): Promise<MarketplacePaymentRow | null> {
  const payment = await getMarketplacePaymentByIntent(input.paymentIntentId);
  if (!payment) return null;
  if (payment.status === "paid") return payment;

  return transitionPayment(payment.id, {
    type: "WEBHOOK_CANCELED",
    reason: input.cancellationReason ?? "payment_intent.canceled",
  });
}
