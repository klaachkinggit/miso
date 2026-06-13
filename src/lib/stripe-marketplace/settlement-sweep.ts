import { createServiceClient } from "@/lib/supabase/service";
import { stripeClient } from "./client";
import { settleSucceededPaymentIntent } from "./fulfillment";
import { handleWebhookEvent } from "./webhook";
import type { MarketplacePaymentRow } from "./payments";

// Background settlement backstop (P0.4). Two cron-driven sweeps:
//
//   1. reDriveStuckPayments — payments whose on-chain fulfillment or
//      connected-account transfers stalled (a webhook runner crashed
//      mid-settlement) sit in succeeded / fulfillment_pending /
//      transfers_pending. Once their lease expires they are safe to
//      re-drive: settleSucceededPaymentIntent re-claims and resumes
//      idempotently.
//
//   2. reconcileStripeEvents — replays recent Stripe events through the
//      webhook handler in case a webhook delivery was missed entirely
//      (handler is idempotent, so replaying delivered events is a no-op).

// Must stay >= fulfillment.ts SETTLEMENT_LEASE_MS so we never re-drive a
// payment a live webhook runner still holds.
const SETTLEMENT_LEASE_MS = 5 * 60 * 1000;

const STUCK_STATUSES = [
  "succeeded",
  "fulfillment_pending",
  "transfers_pending",
] as const;

type StuckRow = Pick<
  MarketplacePaymentRow,
  "id" | "stripe_payment_intent_id" | "stripe_charge_id" | "status" | "last_webhook_at"
>;

export async function reDriveStuckPayments(opts?: {
  limit?: number;
}): Promise<{ scanned: number; reDriven: number; errors: number }> {
  const sb = createServiceClient();
  const leaseExpiry = new Date(Date.now() - SETTLEMENT_LEASE_MS).toISOString();

  const { data, error } = await sb
    .from("marketplace_payments")
    .select("id, stripe_payment_intent_id, stripe_charge_id, status, last_webhook_at")
    .in("status", STUCK_STATUSES as unknown as string[])
    .or(`last_webhook_at.is.null,last_webhook_at.lt.${leaseExpiry}`)
    .order("last_webhook_at", { ascending: true, nullsFirst: true })
    .limit(opts?.limit ?? 50)
    .returns<StuckRow[]>();
  if (error) throw error;

  const rows = data ?? [];
  let reDriven = 0;
  let errors = 0;
  for (const row of rows) {
    // Can only re-drive once Stripe gave us the charge (stamped at claim).
    if (!row.stripe_payment_intent_id || !row.stripe_charge_id) continue;
    try {
      await settleSucceededPaymentIntent({
        paymentIntentId: row.stripe_payment_intent_id,
        chargeId: row.stripe_charge_id,
      });
      reDriven += 1;
    } catch {
      // Per-payment failures stay parked for the next sweep; one bad row
      // must not abort the batch.
      errors += 1;
    }
  }

  return { scanned: rows.length, reDriven, errors };
}

const RECONCILE_EVENT_TYPES = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "account.updated",
] as const;

export async function reconcileStripeEvents(opts?: {
  lookbackHours?: number;
  limit?: number;
}): Promise<{ processed: number; errors: number }> {
  const stripe = stripeClient();
  const sinceSeconds = Math.floor(
    (Date.now() - (opts?.lookbackHours ?? 24) * 60 * 60 * 1000) / 1000,
  );
  const max = opts?.limit ?? 500;

  let processed = 0;
  let errors = 0;
  for await (const event of stripe.events.list({
    created: { gte: sinceSeconds },
    types: [...RECONCILE_EVENT_TYPES],
    limit: 100,
  })) {
    try {
      await handleWebhookEvent(event);
      processed += 1;
    } catch {
      errors += 1;
    }
    if (processed + errors >= max) break;
  }

  return { processed, errors };
}
