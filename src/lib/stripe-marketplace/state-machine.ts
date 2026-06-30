import { createServiceClient } from "@/lib/supabase/service";
import type { MarketplacePaymentRow } from "./payments";

export type PaymentEvent =
  | { type: "CHECKOUT_CREATED"; intentId: string }
  | { type: "WEBHOOK_FAILED_ATTEMPT"; reason: string }
  | { type: "WEBHOOK_CANCELED"; reason: string }
  | { type: "CHECKOUT_ABORTED"; reason: string } // For explicit aborts during HTTP request
  | { type: "WEBHOOK_SUCCEEDED"; chargeId: string }
  | { type: "FULFILLMENT_PENDING"; reason: string }
  | { type: "FULFILLMENT_TERMINAL"; reason: string } // Triggers repair_needed
  | { type: "TRANSFERS_PENDING" }
  | { type: "TRANSFERS_FAILED"; reason: string }
  | { type: "PAID" }
  | { type: "REFUND_PENDING" }
  | { type: "REFUNDED" }
  | { type: "DISPUTED" };

export interface TransitionPlan {
  // null = idempotent no-op (current state is terminal or unchanged for this event)
  patch: Partial<MarketplacePaymentRow> | null;
  sideEffects: {
    releaseInventory: boolean;
    markPurchasePaid: boolean;
    mirrorIntentToPurchase: boolean;
  };
}

// Pure reducer: maps (current_payment, event) → DB patch + side-effect flags.
// No I/O. Tested in __tests__/state-machine.test.ts.
export function reducePaymentTransition(
  payment: MarketplacePaymentRow,
  event: PaymentEvent,
  now: () => string = () => new Date().toISOString(),
): TransitionPlan {
  const noop: TransitionPlan = {
    patch: null,
    sideEffects: {
      releaseInventory: false,
      markPurchasePaid: false,
      mirrorIntentToPurchase: false,
    },
  };
  const patch: Partial<MarketplacePaymentRow> = { last_webhook_at: now() };

  switch (event.type) {
    case "CHECKOUT_CREATED":
      if (payment.status !== "requires_payment") return noop;
      patch.status = "processing";
      patch.stripe_payment_intent_id = event.intentId;
      break;

    case "WEBHOOK_FAILED_ATTEMPT":
      if (payment.status === "paid") return noop;
      patch.failure_reason = event.reason;
      break;

    case "WEBHOOK_CANCELED":
    case "CHECKOUT_ABORTED":
      if (payment.status === "paid" || payment.status === "failed") return noop;
      patch.status = "failed";
      patch.failure_reason = event.reason.slice(0, 500);
      break;

    case "WEBHOOK_SUCCEEDED":
      if (payment.status === "paid") return noop;
      patch.status = "succeeded";
      patch.stripe_charge_id = event.chargeId;
      patch.succeeded_at = payment.succeeded_at ?? now();
      break;

    case "FULFILLMENT_PENDING":
      patch.status = "fulfillment_pending";
      patch.failure_reason = event.reason;
      break;

    case "FULFILLMENT_TERMINAL":
      patch.status = "repair_needed";
      patch.failure_reason = event.reason;
      break;

    case "TRANSFERS_PENDING":
      patch.status = "transfers_pending";
      patch.fulfilled_at = now();
      break;

    case "TRANSFERS_FAILED":
      patch.status = "transfers_pending";
      patch.failure_reason = event.reason;
      break;

    case "PAID":
      patch.status = "paid";
      patch.transferred_at = now();
      break;

    case "REFUND_PENDING":
      patch.status = "refund_pending";
      break;

    case "REFUNDED":
      patch.status = "refunded";
      patch.refunded_at = now();
      break;

    case "DISPUTED":
      patch.status = "disputed";
      patch.disputed_at = now();
      break;
  }

  const isPrimaryWithPurchase =
    payment.kind === "primary" && !!payment.purchase_id;
  return {
    patch,
    sideEffects: {
      releaseInventory: patch.status === "failed",
      markPurchasePaid: patch.status === "paid" && isPrimaryWithPurchase,
      mirrorIntentToPurchase:
        !!patch.stripe_payment_intent_id && isPrimaryWithPurchase,
    },
  };
}

// A single deep seam that enforces valid transitions AND executes all
// cross-table side effects (releasing inventory, syncing legacy tables)
// when a payment enters terminal states.
export async function transitionPayment(
  paymentOrId: string | MarketplacePaymentRow,
  event: PaymentEvent,
): Promise<MarketplacePaymentRow> {
  const sb = createServiceClient();

  let payment: MarketplacePaymentRow;
  if (typeof paymentOrId === "string") {
    const { data, error } = await sb
      .from("marketplace_payments")
      .select("*")
      .eq("id", paymentOrId)
      .single();
    if (error) throw new Error(`Could not find payment ${paymentOrId}`);
    payment = data as MarketplacePaymentRow;
  } else {
    payment = paymentOrId;
  }

  const plan = reducePaymentTransition(payment, event);
  if (!plan.patch) return payment;

  const { data: updated, error: updateError } = await sb
    .from("marketplace_payments")
    .update(plan.patch)
    .eq("id", payment.id)
    .select("*")
    .single();

  if (updateError) throw updateError;
  const newPayment = updated as MarketplacePaymentRow;

  if (plan.sideEffects.releaseInventory) {
    await releaseInventory(newPayment);
  }

  if (plan.sideEffects.markPurchasePaid) {
    const { error } = await sb
      .from("purchases")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", newPayment.purchase_id!)
      .neq("status", "refunded");
    if (error) throw error;
  }

  if (plan.sideEffects.mirrorIntentToPurchase) {
    const { error } = await sb
      .from("purchases")
      .update({
        provider_payment_id: plan.patch.stripe_payment_intent_id,
        payment_provider: "stripe",
      })
      .eq("id", newPayment.purchase_id!);
    if (error) throw error;
  }

  return newPayment;
}

// Side Effect: Release inventory when a payment enters a terminal failed state
async function releaseInventory(payment: MarketplacePaymentRow) {
  const sb = createServiceClient();
  if (payment.kind === "primary") {
    const purchaseIds = payment.purchase_id
      ? [payment.purchase_id]
      : await getPaymentItemPurchaseIds(payment.id);
    if (!purchaseIds.length) return;

    const { data: purchases } = await sb
      .from("purchases")
      .select("id, ticket_id, status")
      .in("id", purchaseIds)
      .returns<Array<{ id: string; ticket_id: string; status: string }>>();
    const failedPurchases = (purchases ?? []).filter(
      (purchase) => purchase.status !== "paid",
    );
    if (!failedPurchases.length) return;

    await sb
      .from("purchases")
      .update({ status: "failed" })
      .in(
        "id",
        failedPurchases.map((purchase) => purchase.id),
      );
    await sb
      .from("tickets")
      .update({
        status: "available",
        reserved_until: null,
        owner_user_id: null,
      })
      .in(
        "id",
        failedPurchases.map((purchase) => purchase.ticket_id),
      )
      .eq("status", "reserved")
      .eq("owner_user_id", payment.buyer_user_id);
  } else if (payment.kind === "resale" && payment.resale_listing_id) {
    await sb
      .from("resale_listings")
      .update({ status: "active", buyer_user_id: null })
      .eq("id", payment.resale_listing_id)
      .eq("status", "transferring")
      .eq("buyer_user_id", payment.buyer_user_id);
  }
}

async function getPaymentItemPurchaseIds(paymentId: string): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("marketplace_payment_items")
    .select("purchase_id")
    .eq("marketplace_payment_id", paymentId)
    .returns<Array<{ purchase_id: string }>>();
  return (data ?? []).map((item) => item.purchase_id);
}
