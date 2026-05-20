import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const webhookMocks = vi.hoisted(() => ({
  settlePaidPurchase: vi.fn(),
  settleFailedPurchase: vi.fn(),
  fulfillResale: vi.fn(),
  update: vi.fn(),
}));

const webhookDb = vi.hoisted(() => ({
  purchasesForSession: [] as Array<{ id: string; ticket_id: string | null }>,
}));

vi.mock("@/lib/payments/settlement", () => ({
  FulfillmentPendingError: class FulfillmentPendingError extends Error {
    name = "FulfillmentPendingError";
  },
  settlePaidPurchase: webhookMocks.settlePaidPurchase,
  settleFailedPurchase: webhookMocks.settleFailedPurchase,
}));

vi.mock("@/lib/resale/listing", () => ({
  ResaleTransferPendingError: class ResaleTransferPendingError extends Error {
    name = "ResaleTransferPendingError";
  },
  fulfillResale: webhookMocks.fulfillResale,
}));

vi.mock("@/lib/chain/ops", () => ({
  ChainOpInFlightError: class ChainOpInFlightError extends Error {
    name = "ChainOpInFlightError";
  },
  ChainOpRepairError: class ChainOpRepairError extends Error {
    name = "ChainOpRepairError";
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === "provider_session_id") {
                return Promise.resolve({ data: webhookDb.purchasesForSession, error: null });
              }
              return {
                maybeSingle: () => Promise.resolve({ data: { ticket_id: "ticket-1" } }),
              };
            },
          }),
        };
      }
      if (table === "resale_listings") {
        const updateMock = {
          eq: () => updateMock,
        };
        return {
          update: (...args: any[]) => {
            webhookMocks.update(...args);
            return updateMock;
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

function event(type: string, session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return {
    id: "evt_1",
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: 1,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    data: { object: session as Stripe.Checkout.Session },
  } as Stripe.Event;
}

describe("Stripe webhook settlement router", () => {
  beforeEach(() => {
    webhookMocks.settlePaidPurchase.mockReset();
    webhookMocks.settleFailedPurchase.mockReset();
    webhookMocks.fulfillResale.mockReset();
    webhookMocks.update.mockReset();
    webhookDb.purchasesForSession = [];
    webhookMocks.update.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
    });
  });

  it("routes paid primary purchase sessions to purchase settlement", async () => {
    const { handleStripeCheckoutEvent } = await import("@/lib/payments/webhook");

    await handleStripeCheckoutEvent(
      event("checkout.session.completed", {
        payment_status: "paid",
        metadata: { type: "purchase", purchase_id: "purchase-1" },
      }),
    );

    expect(webhookMocks.settlePaidPurchase).toHaveBeenCalledWith({ purchaseId: "purchase-1" });
    expect(webhookMocks.fulfillResale).not.toHaveBeenCalled();
  });

  it("settles every purchase attached to a shared checkout session", async () => {
    webhookDb.purchasesForSession = [
      { id: "purchase-1", ticket_id: "ticket-1" },
      { id: "purchase-2", ticket_id: "ticket-2" },
    ];
    const { handleStripeCheckoutEvent } = await import("@/lib/payments/webhook");

    await handleStripeCheckoutEvent(
      event("checkout.session.completed", {
        id: "cs_batch",
        payment_status: "paid",
        metadata: { type: "purchase", purchase_id: "purchase-1" },
      }),
    );

    expect(webhookMocks.settlePaidPurchase).toHaveBeenCalledTimes(2);
    expect(webhookMocks.settlePaidPurchase).toHaveBeenCalledWith({ purchaseId: "purchase-1" });
    expect(webhookMocks.settlePaidPurchase).toHaveBeenCalledWith({ purchaseId: "purchase-2" });
  });

  it("routes paid resale sessions to resale fulfillment", async () => {
    const { handleStripeCheckoutEvent } = await import("@/lib/payments/webhook");

    await handleStripeCheckoutEvent(
      event("checkout.session.async_payment_succeeded", {
        payment_status: "paid",
        metadata: { type: "resale", listing_id: "listing-1", buyer_id: "buyer-1" },
      }),
    );

    expect(webhookMocks.fulfillResale).toHaveBeenCalledWith({
      listingId: "listing-1",
      buyerUserId: "buyer-1",
    });
  });

  it("ignores completed checkout sessions that are not paid", async () => {
    const { handleStripeCheckoutEvent } = await import("@/lib/payments/webhook");

    await handleStripeCheckoutEvent(
      event("checkout.session.completed", {
        payment_status: "unpaid",
        metadata: { type: "purchase", purchase_id: "purchase-1" },
      }),
    );

    expect(webhookMocks.settlePaidPurchase).not.toHaveBeenCalled();
    expect(webhookMocks.fulfillResale).not.toHaveBeenCalled();
  });

  it("releases purchase reservations and resale claims for failed sessions", async () => {
    const { handleStripeCheckoutEvent } = await import("@/lib/payments/webhook");

    await handleStripeCheckoutEvent(
      event("checkout.session.expired", {
        metadata: { type: "purchase", purchase_id: "purchase-1" },
      }),
    );
    await handleStripeCheckoutEvent(
      event("checkout.session.async_payment_failed", {
        metadata: { type: "resale", listing_id: "listing-1", buyer_id: "buyer-1" },
      }),
    );

    expect(webhookMocks.settleFailedPurchase).toHaveBeenCalledWith({
      purchaseId: "purchase-1",
      ticketId: "ticket-1",
    });
    expect(webhookMocks.update).toHaveBeenCalledWith({ status: "active", buyer_user_id: null });
  });

  it("classifies known settlement delays by error name fallback", async () => {
    const { isKnownCheckoutSettlementDelay } = await import("@/lib/payments/webhook");
    const pending = new Error("pending");
    pending.name = "ChainOpRepairError";

    expect(isKnownCheckoutSettlementDelay(pending)).toBe(true);
    expect(isKnownCheckoutSettlementDelay(new Error("boom"))).toBe(false);
  });
});
