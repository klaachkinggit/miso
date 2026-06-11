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

// Strongly-typed settlement events. The webhook route consumes only these
// shapes; raw Stripe event + metadata never leaks past the adapter.
export type CheckoutSettlementEvent =
  | {
      kind: "purchase";
      outcome: "paid" | "failed";
      purchaseId: string;
      sessionId: string | null;
    }
  | {
      kind: "resale";
      outcome: "paid" | "failed";
      listingId: string;
      buyerUserId: string;
      sessionId: string | null;
    }
  | { kind: "unknown" };

type ServiceClient = ReturnType<typeof createServiceClient>;
type CheckoutPurchaseRow = { id: string; ticket_id: string | null };

// --- Adapter -----------------------------------------------------------

const PAID_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const FAILED_EVENT_TYPES = new Set([
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
]);

export function parseCheckoutSettlementEvent(
  event: Stripe.Event,
): CheckoutSettlementEvent {
  if (!event.type.startsWith("checkout.session.")) return { kind: "unknown" };
  const outcome: "paid" | "failed" | null = PAID_EVENT_TYPES.has(event.type)
    ? "paid"
    : FAILED_EVENT_TYPES.has(event.type)
      ? "failed"
      : null;
  if (!outcome) return { kind: "unknown" };

  const session = event.data.object as Stripe.Checkout.Session;
  // Paid sessions must actually be paid; some race shapes deliver
  // `completed` before payment settles.
  if (outcome === "paid" && session.payment_status !== "paid") {
    return { kind: "unknown" };
  }

  const metadata = session.metadata ?? {};
  if (metadata.type === "purchase" && metadata.purchase_id) {
    return {
      kind: "purchase",
      outcome,
      purchaseId: metadata.purchase_id,
      sessionId: session.id,
    };
  }
  if (
    metadata.type === "resale" &&
    metadata.listing_id &&
    metadata.buyer_id
  ) {
    return {
      kind: "resale",
      outcome,
      listingId: metadata.listing_id,
      buyerUserId: metadata.buyer_id,
      sessionId: session.id,
    };
  }
  return { kind: "unknown" };
}

// --- Dispatcher --------------------------------------------------------

export async function handleStripeCheckoutEvent(
  event: Stripe.Event,
): Promise<void> {
  const settlement = parseCheckoutSettlementEvent(event);
  if (settlement.kind === "unknown") return;
  if (settlement.kind === "purchase") {
    if (settlement.outcome === "paid") {
      await settlePaidPurchaseSession(settlement);
    } else {
      await settleFailedPurchaseSession(settlement);
    }
    return;
  }
  if (settlement.outcome === "paid") {
    await fulfillResale({
      listingId: settlement.listingId,
      buyerUserId: settlement.buyerUserId,
    });
  } else {
    await releaseResaleClaim(settlement);
  }
}

// --- Per-kind handlers (kept inside this module since the dispatch +
// purchases-for-session lookup are tied together) -----------------------

async function settlePaidPurchaseSession(event: Extract<
  CheckoutSettlementEvent,
  { kind: "purchase" }
>): Promise<void> {
  const sb = createServiceClient();
  const purchases = await purchasesForCheckoutSession(sb, event.sessionId);
  if (purchases.length > 0) {
    await Promise.all(
      purchases.map((purchase) => settlePaidPurchase({ purchaseId: purchase.id })),
    );
    return;
  }
  await settlePaidPurchase({ purchaseId: event.purchaseId });
}

async function settleFailedPurchaseSession(event: Extract<
  CheckoutSettlementEvent,
  { kind: "purchase" }
>): Promise<void> {
  const sb = createServiceClient();
  const purchases = await purchasesForCheckoutSession(sb, event.sessionId);
  if (purchases.length > 0) {
    await Promise.all(
      purchases.map((purchase) =>
        settleFailedPurchase({
          purchaseId: purchase.id,
          ticketId: purchase.ticket_id ?? undefined,
        }),
      ),
    );
    return;
  }
  const purchase = await purchaseForMetadataId(sb, event.purchaseId);
  await settleFailedPurchase({
    purchaseId: event.purchaseId,
    ticketId: purchase?.ticket_id ?? undefined,
  });
}

async function releaseResaleClaim(event: Extract<
  CheckoutSettlementEvent,
  { kind: "resale" }
>): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("resale_listings")
    .update({ status: "active", buyer_user_id: null })
    .eq("id", event.listingId)
    .eq("status", "transferring")
    .eq("buyer_user_id", event.buyerUserId);
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
