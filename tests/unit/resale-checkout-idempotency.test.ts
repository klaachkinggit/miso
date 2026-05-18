import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  createResaleStripeCheckoutSession: vi.fn(),
  expireStripeCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/payments/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: stripeMocks.retrieve,
      },
    },
  },
  createResaleStripeCheckoutSession: stripeMocks.createResaleStripeCheckoutSession,
  expireStripeCheckoutSession: stripeMocks.expireStripeCheckoutSession,
}));

vi.mock("@/lib/chain/ops", () => ({
  ChainOpRepairError: class ChainOpRepairError extends Error {},
  markChainOpMined: vi.fn(),
  markChainOpRepairNeeded: vi.fn(),
  openOrResumeChainOp: vi.fn(),
  runChainOp: vi.fn(),
  TransactionRevertError: class TransactionRevertError extends Error {},
  TransactionTimeoutError: class TransactionTimeoutError extends Error {},
}));

vi.mock("@/lib/thirdweb/transactions", () => ({
  backendWallet: vi.fn(),
}));

vi.mock("@/lib/thirdweb/wallet", () => ({
  ensureUserWallet: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  markTicketListed: vi.fn(),
  markTicketResaleCanceled: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  priorListing: null as Record<string, unknown> | null,
  updateCalled: false,
}));

class QueryMock {
  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  maybeSingle() {
    if (this.table === "resale_listings") {
      return Promise.resolve({ data: dbState.priorListing, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  update() {
    dbState.updateCalled = true;
    return this;
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new QueryMock(table),
  }),
}));

describe("checkoutResaleListing idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
    stripeMocks.retrieve.mockReset();
    stripeMocks.createResaleStripeCheckoutSession.mockReset();
    stripeMocks.expireStripeCheckoutSession.mockReset();
    dbState.updateCalled = false;
    dbState.priorListing = {
      id: "listing-1",
      buyer_user_id: "buyer-1",
      provider_session_id: "cs_resale_1",
      checkout_idempotency_key: "idem-1",
    };
    stripeMocks.retrieve.mockResolvedValue({ url: "https://stripe.test/resale" });
  });

  it("replays an existing resale Stripe session before claiming the listing", async () => {
    const { checkoutResaleListing } = await import("@/lib/resale/listing");

    const result = await checkoutResaleListing({
      listingId: "listing-1",
      buyerUserId: "buyer-1",
      successUrl: "https://miso.test/success",
      cancelUrl: "https://miso.test/cancel",
      idempotencyKey: "idem-1",
    });

    expect(result.checkoutUrl).toBe("https://stripe.test/resale");
    expect(stripeMocks.retrieve).toHaveBeenCalledWith("cs_resale_1");
    expect(stripeMocks.createResaleStripeCheckoutSession).not.toHaveBeenCalled();
    expect(dbState.updateCalled).toBe(false);
  });
});
