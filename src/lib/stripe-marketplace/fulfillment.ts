import * as Sentry from "@sentry/nextjs";

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
  sendPurchaseReceipt,
  sendResaleBoughtNotice,
  sendResaleSoldNotice,
} from "@/lib/email/send";
import { ensureAutoFollow } from "@/lib/followers";

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

interface ItemPurchase {
  purchase_id: string;
  ticket_id: string;
  buyer_user_id: string;
  status: string;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

// Resolves the per-ticket purchases a primary payment must fulfill. New
// multi-item payments carry purchase_id = null and link via
// marketplace_payment_items; pre-backfill legacy payments carry a single
// purchase_id and no items — fall back to that for replay safety.
async function loadPrimaryItemPurchases(
  sb: ServiceClient,
  payment: MarketplacePaymentRow,
): Promise<ItemPurchase[]> {
  const { data: items } = await sb
    .from("marketplace_payment_items")
    .select("purchase_id, purchases(id, ticket_id, buyer_user_id, status)")
    .eq("marketplace_payment_id", payment.id)
    .returns<
      Array<{
        purchase_id: string;
        purchases: {
          id: string;
          ticket_id: string;
          buyer_user_id: string;
          status: string;
        } | null;
      }>
    >();

  if (items && items.length > 0) {
    return items.map((item) => {
      if (!item.purchases) {
        throw new Error(`purchase ${item.purchase_id} missing`);
      }
      return {
        purchase_id: item.purchases.id,
        ticket_id: item.purchases.ticket_id,
        buyer_user_id: item.purchases.buyer_user_id,
        status: item.purchases.status,
      };
    });
  }

  if (payment.purchase_id) {
    const { data: purchase } = await sb
      .from("purchases")
      .select("ticket_id, buyer_user_id, status")
      .eq("id", payment.purchase_id)
      .single<{ ticket_id: string; buyer_user_id: string; status: string }>();
    if (!purchase) throw new Error(`purchase ${payment.purchase_id} missing`);
    return [
      {
        purchase_id: payment.purchase_id,
        ticket_id: purchase.ticket_id,
        buyer_user_id: purchase.buyer_user_id,
        status: purchase.status,
      },
    ];
  }

  return [];
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
      const items = await loadPrimaryItemPurchases(sb, stamped);
      if (items.length === 0) {
        throw new Error(`primary payment ${stamped.id} has no items`);
      }
      // All-or-nothing at the payment level (ADR 0002): every item must
      // mint before transfers fire. fulfillReservedTicket is idempotent
      // (already-sold-for-this-purchase fast-path) so replaying the webhook
      // after a partial mint re-fulfills only the unminted tickets.
      for (const item of items) {
        await fulfillReservedTicket({
          ticketId: item.ticket_id,
          buyerUserId: item.buyer_user_id,
          purchaseId: item.purchase_id,
        });
      }
      // purchase_id is null on multi-item payments, so the state machine's
      // markPurchasePaid side-effect never fires; mark each item purchase
      // paid here (mirrors the legacy single-purchase semantics).
      await sb
        .from("purchases")
        .update({ status: "paid", paid_at: nowIso })
        .in(
          "id",
          items.map((i) => i.purchase_id),
        )
        .neq("status", "refunded");
    } else {
      if (!stamped.resale_listing_id) {
        throw new Error(`resale payment ${stamped.id} missing listing_id`);
      }
      await fulfillResale({
        listingId: stamped.resale_listing_id,
        buyerUserId: stamped.buyer_user_id,
      });
    }
  } catch (err) {
    const pending = isPendingFulfillmentError(err);
    const isRepair =
      err instanceof ChainOpRepairError ||
      (err instanceof Error && err.name === "ChainOpRepairError");
    const terminal = !pending && !isRepair && isTerminalFulfillmentError(err);

    // Payment is leaving the happy path into repair_needed / terminal /
    // pending — surface it for on-call. Safe no-op without a DSN.
    Sentry.captureException(err);

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

  // Best-effort delivery emails. The send-* helpers never throw and are a
  // no-op without email env configured, so this cannot change settlement's
  // outcome — `paid` is already committed above.
  await sendSettlementEmails(sb, stamped);

  // Best-effort auto-follow: the buyer follows the purchased event's
  // Organization so it can reach them with announcements. ensureAutoFollow is
  // fully internally caught and the org lookup is guarded below, so this can
  // never throw into settlement — `paid` is already committed above.
  await autoFollowBuyer(sb, stamped);

  return paid;
}

// Resolves the purchased event's organization and follows the buyer to it.
// Never throws: the lookup is wrapped and ensureAutoFollow is itself fully
// internally caught. Called only after a payment is PAID.
async function autoFollowBuyer(
  sb: ServiceClient,
  payment: MarketplacePaymentRow,
): Promise<void> {
  try {
    let ticketId: string | undefined;
    if (payment.kind === "primary") {
      const items = await loadPrimaryItemPurchases(sb, payment);
      ticketId = items[0]?.ticket_id;
    } else if (payment.resale_listing_id) {
      const { data: listing } = await sb
        .from("resale_listings")
        .select("ticket_id")
        .eq("id", payment.resale_listing_id)
        .maybeSingle<{ ticket_id: string }>();
      ticketId = listing?.ticket_id;
    }
    if (!ticketId) return;

    const { data: ticket } = await sb
      .from("tickets")
      .select("event_id")
      .eq("id", ticketId)
      .maybeSingle<{ event_id: string }>();
    if (!ticket?.event_id) return;

    const { data: event } = await sb
      .from("events")
      .select("organization_id")
      .eq("id", ticket.event_id)
      .maybeSingle<{ organization_id: string | null }>();
    if (!event?.organization_id) return;

    await ensureAutoFollow({
      organizationId: event.organization_id,
      userId: payment.buyer_user_id,
    });
  } catch (err) {
    console.error("[followers] autoFollowBuyer failed", err);
  }
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Resolves event/category display strings for the receipt emails. Returns
// safe fallbacks rather than throwing — never blocks settlement.
async function sendSettlementEmails(
  sb: ServiceClient,
  payment: MarketplacePaymentRow,
): Promise<void> {
  // Fully internally caught: gathering display data hits tables the send
  // helpers don't own, so any lookup error must be swallowed here too. This
  // function never throws — settlement is already committed by the caller.
  try {
    if (payment.kind === "primary") {
      const items = await loadPrimaryItemPurchases(sb, payment);
      const firstTicketId = items[0]?.ticket_id;
      const { eventName, category } = await loadTicketDisplay(sb, firstTicketId);
      await sendPurchaseReceipt({
        buyerUserId: payment.buyer_user_id,
        eventName,
        category,
        quantity: items.length,
        amount: formatEur(payment.amount_total_cents),
      });
      return;
    }

    let ticketId: string | undefined;
    if (payment.resale_listing_id) {
      const { data: listing } = await sb
        .from("resale_listings")
        .select("ticket_id")
        .eq("id", payment.resale_listing_id)
        .maybeSingle<{ ticket_id: string }>();
      ticketId = listing?.ticket_id;
    }
    const { eventName } = await loadTicketDisplay(sb, ticketId);
    await sendResaleBoughtNotice({
      buyerUserId: payment.buyer_user_id,
      eventName,
      amount: formatEur(payment.amount_total_cents),
    });
    await sendResaleSoldNotice({
      sellerUserId: payment.primary_seller_user_id,
      eventName,
      listingPrice: formatEur(payment.amount_total_cents),
    });
  } catch (err) {
    console.error("[email] settlement notifications failed", err);
  }
}

async function loadTicketDisplay(
  sb: ServiceClient,
  ticketId: string | undefined,
): Promise<{ eventName: string; category: string }> {
  if (!ticketId) return { eventName: "your event", category: "Ticket" };
  const { data: ticket } = await sb
    .from("tickets")
    .select("event_id, category_id")
    .eq("id", ticketId)
    .maybeSingle<{ event_id: string; category_id: string | null }>();
  if (!ticket) return { eventName: "your event", category: "Ticket" };
  const { data: event } = await sb
    .from("events")
    .select("name")
    .eq("id", ticket.event_id)
    .maybeSingle<{ name: string }>();
  let category = "Ticket";
  if (ticket.category_id) {
    const { data: cat } = await sb
      .from("ticket_categories")
      .select("name")
      .eq("id", ticket.category_id)
      .maybeSingle<{ name: string }>();
    if (cat?.name) category = cat.name;
  }
  return { eventName: event?.name ?? "your event", category };
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
