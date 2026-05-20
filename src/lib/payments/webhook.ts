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

type ServiceClient = ReturnType<typeof createServiceClient>;
type CheckoutPurchaseRow = { id: string; ticket_id: string | null };

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

    const purchases = await purchasesForCheckoutSession(sb, session.id);
    if (purchases.length > 0) {
      await Promise.all(
        purchases.map((purchase) => settlePaidPurchase({ purchaseId: purchase.id })),
      );
    } else {
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

    const purchases = await purchasesForCheckoutSession(sb, session.id);
    if (purchases.length > 0) {
      await Promise.all(
        purchases.map((purchase) =>
          settleFailedPurchase({
            purchaseId: purchase.id,
            ticketId: purchase.ticket_id ?? undefined,
          }),
        ),
      );
    } else {
      const purchase = await purchaseForMetadataId(sb, metadata.purchaseId);
      await settleFailedPurchase({
        purchaseId: metadata.purchaseId,
        ticketId: purchase?.ticket_id ?? undefined,
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

async function purchasesForCheckoutSession(
  sb: ServiceClient,
  sessionId: string | null,
): Promise<CheckoutPurchaseRow[]> {
  if (!sessionId) return [];

  const { data: purchases } = await sb
    .from("purchases")
    .select("id, ticket_id")
    .eq("provider_session_id", sessionId);

  return purchases ?? [];
}

async function purchaseForMetadataId(
  sb: ServiceClient,
  purchaseId: string,
): Promise<Pick<CheckoutPurchaseRow, "ticket_id"> | null> {
  const { data: purchase } = await sb
    .from("purchases")
    .select("ticket_id")
    .eq("id", purchaseId)
    .maybeSingle<{ ticket_id: string }>();

  return purchase;
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
