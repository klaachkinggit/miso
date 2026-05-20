import {
  FulfillmentPendingError,
  settleFailedPurchase,
  settlePaidPurchase,
} from "@/lib/payments/settlement";
import {
  fulfillResale,
  ResaleTransferPendingError,
} from "@/lib/resale/listing";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
} from "@/lib/chain/ops";
import type Stripe from "stripe";

type CheckoutMetadata =
  | { type: "purchase"; purchaseId: string }
  | { type: "resale"; listingId: string; buyerUserId: string }
  | { type: "unknown" };

export async function handleStripeCheckoutEvent(
  event: Stripe.Event,
): Promise<void> {
  if (!isCheckoutSessionEvent(event)) return;

  const session = event.data.object as Stripe.Checkout.Session;

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await settlePaidCheckoutSession(session);
    return;
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    await settleFailedCheckoutSession(session);
  }
}

async function settlePaidCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const metadata = checkoutMetadata(session);
  if (metadata.type === "purchase") {
    const sb = createServiceClient();
    const { data: purchases } = await sb
      .from("purchases")
      .select("id")
      .eq("provider_session_id", session.id);
    
    if (purchases) {
      await Promise.all(purchases.map(p => settlePaidPurchase({ purchaseId: p.id })));
    } else if (metadata.purchaseId) {
      await settlePaidPurchase({ purchaseId: metadata.purchaseId });
    }
    return;
  }

  if (metadata.type === "resale") {
    await fulfillResale({
      listingId: metadata.listingId,
      buyerUserId: metadata.buyerUserId,
    });
  }
}

async function settleFailedCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = checkoutMetadata(session);
  if (metadata.type === "purchase") {
    const sb = createServiceClient();
    const { data: purchases } = await sb
      .from("purchases")
      .select("id, ticket_id")
      .eq("provider_session_id", session.id);
      
    if (purchases && purchases.length > 0) {
      await Promise.all(purchases.map(p => settleFailedPurchase({
        purchaseId: p.id,
        ticketId: p.ticket_id,
      })));
    } else if (metadata.purchaseId) {
      const { data: purchase } = await sb
        .from("purchases")
        .select("ticket_id")
        .eq("id", metadata.purchaseId)
        .maybeSingle<{ ticket_id: string }>();
      await settleFailedPurchase({
        purchaseId: metadata.purchaseId,
        ticketId: purchase?.ticket_id,
      });
    }
    return;
  }

  if (metadata.type === "resale") {
    const sb = createServiceClient();
    await sb
      .from("resale_listings")
      .update({ status: "active", buyer_user_id: null })
      .eq("id", metadata.listingId)
      .eq("status", "transferring")
      .eq("buyer_user_id", metadata.buyerUserId);
  }
}

export function isKnownCheckoutSettlementDelay(error: unknown): boolean {
  return (
    error instanceof FulfillmentPendingError ||
    error instanceof ResaleTransferPendingError ||
    error instanceof ChainOpInFlightError ||
    error instanceof ChainOpRepairError ||
    (error instanceof Error &&
      [
        "FulfillmentPendingError",
        "ResaleTransferPendingError",
        "ChainOpInFlightError",
        "ChainOpRepairError",
      ].includes(error.name))
  );
}

function checkoutMetadata(session: Stripe.Checkout.Session): CheckoutMetadata {
  const metadata = session.metadata ?? {};

  if (metadata.type === "purchase" && metadata.purchase_id) {
    return { type: "purchase", purchaseId: metadata.purchase_id };
  }

  if (metadata.type === "resale" && metadata.listing_id && metadata.buyer_id) {
    return {
      type: "resale",
      listingId: metadata.listing_id,
      buyerUserId: metadata.buyer_id,
    };
  }

  return { type: "unknown" };
}

function isCheckoutSessionEvent(event: Stripe.Event): boolean {
  return event.type.startsWith("checkout.session.");
}
