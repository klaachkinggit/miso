import { beforeEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  reserveTicket: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  expireStripeCheckoutSession: vi.fn(),
  settleFailedPurchase: vi.fn(),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  reserveTicket: checkoutMocks.reserveTicket,
}));

vi.mock("@/lib/payments/stripe", () => ({
  createStripeCheckoutSession: checkoutMocks.createStripeCheckoutSession,
  expireStripeCheckoutSession: checkoutMocks.expireStripeCheckoutSession,
  stripe: {
    checkout: {
      sessions: {
        retrieve: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/payments/settlement", () => ({
  settleFailedPurchase: checkoutMocks.settleFailedPurchase,
}));

const dbState = vi.hoisted(() => ({
  friend: null as { id: string; email: string } | null,
  insertedPurchase: null as Record<string, unknown> | null,
  event: { id: "event-1", name: "Miso Night", organization_id: null as string | null },
  organization: null as {
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_details_submitted: boolean;
  } | null,
}));

class QueryMock {
  private filters: Record<string, unknown> = {};
  private insertPayload: Record<string, unknown> | null = null;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.insertPayload = payload;
    dbState.insertedPurchase = payload;
    return this;
  }

  update() {
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters[column] = values;
    return this;
  }

  maybeSingle() {
    if (this.table === "profiles") {
      return Promise.resolve({ data: dbState.friend, error: null });
    }
    if (this.table === "purchases") {
      return Promise.resolve({ data: null, error: null });
    }
    if (this.table === "organizations") {
      return Promise.resolve({ data: dbState.organization, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  single() {
    if (this.table === "events") {
      return Promise.resolve({
        data: dbState.event,
        error: null,
      });
    }
    if (this.table === "ticket_categories") {
      return Promise.resolve({
        data: { id: "category-1", name: "VIP", kind: "standard", price: 40, currency: "EUR" },
        error: null,
      });
    }
    if (this.table === "purchases") {
      return Promise.resolve({
        data: {
          id: "purchase-1",
          ...(this.insertPayload ?? {}),
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new QueryMock(table),
  }),
}));

describe("createPurchaseCheckout gift recipient flow", () => {
  beforeEach(() => {
    checkoutMocks.reserveTicket.mockReset();
    checkoutMocks.createStripeCheckoutSession.mockReset();
    checkoutMocks.expireStripeCheckoutSession.mockReset();
    checkoutMocks.settleFailedPurchase.mockReset();
    dbState.friend = null;
    dbState.insertedPurchase = null;
    dbState.event = { id: "event-1", name: "Miso Night", organization_id: null };
    dbState.organization = null;

    checkoutMocks.reserveTicket.mockResolvedValue({
      ticket: {
        id: "ticket-1",
        event_id: "event-1",
        category_id: "category-1",
      },
      category: {
        id: "category-1",
        kind: "standard",
        price: 40,
        currency: "EUR",
      },
    });
    checkoutMocks.createStripeCheckoutSession.mockResolvedValue({
      id: "cs_1",
      url: "https://stripe.test/checkout",
    });
  });

  it("rejects unknown gift recipients before reserving inventory", async () => {
    const { createPurchaseCheckout, GiftRecipientNotFoundError } = await import(
      "@/lib/payments/checkout"
    );

    await expect(
      createPurchaseCheckout({
        buyerUserId: "buyer-1",
        categoryId: "category-1",
        giftRecipientEmail: "FRIEND@EXAMPLE.COM",
        successUrl: "https://miso.test/success",
        cancelUrl: "https://miso.test/cancel",
      }),
    ).rejects.toBeInstanceOf(GiftRecipientNotFoundError);

    expect(checkoutMocks.reserveTicket).not.toHaveBeenCalled();
    expect(checkoutMocks.settleFailedPurchase).not.toHaveBeenCalled();
  });

  it("persists the registered gift recipient and lowercases their email lookup", async () => {
    dbState.friend = { id: "friend-1", email: "friend@example.com" };
    const { createPurchaseCheckout } = await import("@/lib/payments/checkout");

    const result = await createPurchaseCheckout({
      buyerUserId: "buyer-1",
      categoryId: "category-1",
      giftRecipientEmail: "FRIEND@EXAMPLE.COM",
      successUrl: "https://miso.test/success",
      cancelUrl: "https://miso.test/cancel",
    });

    expect(result).toEqual({
      purchaseId: "purchase-1",
      checkoutUrl: "https://stripe.test/checkout",
      idempotentReplay: false,
    });
    expect(checkoutMocks.reserveTicket).toHaveBeenCalledWith({
      categoryId: "category-1",
      buyerUserId: "buyer-1",
    });
    expect(dbState.insertedPurchase).toMatchObject({
      buyer_user_id: "buyer-1",
      ticket_id: "ticket-1",
      gift_recipient_user_id: "friend-1",
      amount: 40,
      platform_fee_amount: 1.6,
      stripe_fee_amount: 0.89,
      buyer_total_amount: 42.49,
      currency: "EUR",
      status: "pending",
      sales_channel: "mini_site",
      tracking_origin: null,
    });
    expect(checkoutMocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 40,
        quantity: 1,
        platformFeeAmount: 1.6,
        stripeFeeAmount: 0.89,
      }),
      expect.any(Object),
    );
  });

  it("persists server-derived checkout attribution", async () => {
    const { createPurchaseCheckout } = await import("@/lib/payments/checkout");

    await createPurchaseCheckout({
      buyerUserId: "buyer-1",
      categoryId: "category-1",
      successUrl: "https://miso.test/success",
      cancelUrl: "https://miso.test/cancel",
      salesChannel: "qr",
      trackingOrigin: "host:boilerroom path:/events/drop",
    });

    expect(dbState.insertedPurchase).toMatchObject({
      sales_channel: "qr",
      tracking_origin: "host:boilerroom path:/events/drop",
    });
  });

  it("blocks paid organization checkout until Stripe onboarding is complete", async () => {
    dbState.event = { id: "event-1", name: "Miso Night", organization_id: "org-1" };
    dbState.organization = {
      stripe_account_id: "acct_1",
      stripe_charges_enabled: false,
      stripe_details_submitted: true,
    };
    const { createPurchaseCheckout } = await import("@/lib/payments/checkout");

    await expect(
      createPurchaseCheckout({
        buyerUserId: "buyer-1",
        categoryId: "category-1",
        successUrl: "https://miso.test/success",
        cancelUrl: "https://miso.test/cancel",
      }),
    ).rejects.toThrow("Stripe onboarding is complete");

    expect(dbState.insertedPurchase).toBeNull();
    expect(checkoutMocks.createStripeCheckoutSession).not.toHaveBeenCalled();
  });
});
