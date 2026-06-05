import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: stripeMocks.sessionsCreate,
      },
    };
  },
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  RESERVATION_TTL_SECONDS: 1_800,
}));

describe("Stripe checkout session builders", () => {
  beforeEach(() => {
    vi.resetModules();
    stripeMocks.sessionsCreate.mockReset();
    stripeMocks.sessionsCreate.mockResolvedValue({ id: "cs_test", url: "https://stripe.test/session" });
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  });

  it("creates purchase sessions with metadata, cent amounts, TTL, and idempotency", async () => {
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
    const { createStripeCheckoutSession } = await import("@/lib/payments/stripe");

    await createStripeCheckoutSession(
      {
        purchaseId: "purchase-1",
        amount: 12.345,
        quantity: 2,
        platformFeeAmount: 1.25,
        stripeFeeAmount: 0.75,
        currency: "EUR",
        eventName: "Miso Night",
        categoryName: "VIP",
        successUrl: "https://miso.test/success",
        cancelUrl: "https://miso.test/cancel",
      },
      { idempotencyKey: "checkout-key" },
    );

    const [payload, opts] = stripeMocks.sessionsCreate.mock.calls[0]!;
    expect(payload).toMatchObject({
      mode: "payment",
      success_url: "https://miso.test/success",
      cancel_url: "https://miso.test/cancel",
      metadata: {
        type: "purchase",
        purchase_id: "purchase-1",
        seller_amount: "24.69",
        platform_fee_amount: "1.25",
        stripe_fee_amount: "0.75",
        buyer_total: "26.69",
      },
      expires_at: Math.floor(Date.parse("2026-05-18T12:00:00Z") / 1000) + 1_800,
    });
    expect(payload.line_items).toHaveLength(3);
    expect(payload.line_items[0].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 1235,
      product_data: { name: "Miso Night — VIP" },
    });
    expect(payload.line_items[0].quantity).toBe(2);
    expect(payload.line_items[1].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 125,
      product_data: { name: "MISO service fee" },
    });
    expect(payload.line_items[2].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 75,
      product_data: { name: "Payment processing fee" },
    });
    expect(payload.payment_method_types).toBeUndefined();
    expect(opts).toEqual({ idempotencyKey: "checkout-key" });
    vi.useRealTimers();
  });

  it("creates resale sessions with seller amount, optional fee/royalty lines, and buyer total metadata", async () => {
    const { createResaleStripeCheckoutSession } = await import("@/lib/payments/stripe");

    await createResaleStripeCheckoutSession({
      listingId: "listing-1",
      buyerUserId: "buyer-1",
      amount: 50,
      platformFeeAmount: 2.5,
      royaltyAmount: 5,
      currency: "EUR",
      eventName: "Miso Night",
      categoryName: "Balcony",
      successUrl: "https://miso.test/resale/success",
      cancelUrl: "https://miso.test/resale/cancel",
      idempotencyKey: "resale-key",
    });

    const [payload, opts] = stripeMocks.sessionsCreate.mock.calls[0]!;
    expect(payload.line_items).toHaveLength(3);
    expect(payload.line_items[0].price_data.unit_amount).toBe(5_000);
    expect(payload.line_items[1].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 250,
      product_data: { name: "MISO marketplace platform fee" },
    });
    expect(payload.line_items[2].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 500,
      product_data: { name: "Organizer resale royalty" },
    });
    expect(payload.metadata).toMatchObject({
      type: "resale",
      listing_id: "listing-1",
      buyer_id: "buyer-1",
      seller_amount: "50",
      platform_fee_amount: "2.5",
      royalty_amount: "5",
      buyer_total: "57.5",
    });
    expect(payload.payment_method_types).toBeUndefined();
    expect(opts).toEqual({ idempotencyKey: "resale-key" });
  });

  it("omits the resale fee line and request options when not needed", async () => {
    const { createResaleStripeCheckoutSession } = await import("@/lib/payments/stripe");

    await createResaleStripeCheckoutSession({
      listingId: "listing-1",
      buyerUserId: "buyer-1",
      amount: 50,
      platformFeeAmount: 0,
      currency: "EUR",
      eventName: "Miso Night",
      categoryName: "Balcony",
      successUrl: "https://miso.test/resale/success",
      cancelUrl: "https://miso.test/resale/cancel",
    });

    const [payload, opts] = stripeMocks.sessionsCreate.mock.calls[0]!;
    expect(payload.line_items).toHaveLength(1);
    expect(payload.metadata.platform_fee_amount).toBe("0");
    expect(payload.metadata.royalty_amount).toBe("0");
    expect(opts).toBeUndefined();
  });
});
