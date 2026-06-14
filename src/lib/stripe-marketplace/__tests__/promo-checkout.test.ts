import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

import {
  createFakeServiceClient,
  resetFakeDb,
  fakeDb,
  fakeStripe,
} from "./helpers/fake-marketplace";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createFakeServiceClient(),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../client", () => ({
  stripeEnv: () => ({ MISO_MARKETPLACE_FEE_BPS: 500 }),
  stripeClient: () => fakeStripe,
}));

vi.mock("../seller-accounts", () => ({
  assertPayoutReady: vi.fn().mockResolvedValue({ stripe_account_id: "acct_org" }),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  reserveTicket: vi.fn(async ({ buyerUserId }: { buyerUserId: string }) => {
    const ticket = fakeDb.reserveNextTicket(buyerUserId);
    return { ticket, category: fakeDb.category };
  }),
  releaseReservation: vi.fn(async (id: string) => fakeDb.releaseTicket(id)),
}));

vi.mock("@/lib/payments/checkout", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/checkout")>(
    "@/lib/payments/checkout",
  );
  return { ...actual, resolveGiftRecipientUserId: vi.fn().mockResolvedValue(null) };
});

const promoMocks = vi.hoisted(() => ({
  validateAndPricePromo: vi.fn(),
  markPromoUsed: vi.fn(),
  releasePromoUse: vi.fn(),
}));

vi.mock("@/lib/promo", () => ({
  validateAndPricePromo: promoMocks.validateAndPricePromo,
  markPromoUsed: promoMocks.markPromoUsed,
  releasePromoUse: promoMocks.releasePromoUse,
}));

function seedWithOrg(price: number) {
  fakeDb.seedEvent({ price });
  // createPrimaryCheckout resolves the promo against event.organization_id.
  const event = fakeDb.events.get("event-1")!;
  event.organization_id = "org-1";
}

describe("createPrimaryCheckout with promo code", () => {
  beforeEach(() => {
    resetFakeDb();
    fakeStripe.reset();
    promoMocks.validateAndPricePromo.mockReset();
    promoMocks.markPromoUsed.mockReset();
    promoMocks.releasePromoUse.mockReset();
    promoMocks.releasePromoUse.mockResolvedValue(undefined);
  });

  it("feeds the discounted gross through the breakdown and records discount_cents", async () => {
    seedWithOrg(100); // gross = 10_000 cents
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(true);

    const { createPrimaryCheckout } = await import("../payments");
    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      promoCode: "TWENTYOFF",
    });
    if ("free" in result) throw new Error("expected a paid checkout");

    // Discounted gross = 10_000 - 2_000 = 8_000.
    assert.equal(result.amountTotalCents, 8_000);
    assert.equal(fakeStripe.intents.length, 1);
    assert.equal(fakeStripe.intents[0].amount, 8_000);

    const payment = [...fakeDb.payments.values()][0];
    assert.equal(Number(payment.amount_total_cents), 8_000);
    assert.equal(Number(payment.discount_cents), 2_000);
    assert.equal(payment.promo_code_id, "promo-1");
    // Fee recomputes on the discounted gross: 5% of 8_000 = 400.
    assert.equal(Number(payment.marketplace_fee_cents), 400);
    assert.equal(Number(payment.primary_seller_cents), 7_600);

    const items = [...fakeDb.items.values()];
    const itemTotal = items.reduce((sum, i) => sum + Number(i.amount_cents), 0);
    assert.equal(itemTotal, 8_000);

    assert.equal(promoMocks.validateAndPricePromo.mock.calls.length, 1);
    assert.deepEqual(promoMocks.validateAndPricePromo.mock.calls[0][0], {
      code: "TWENTYOFF",
      organizationId: "org-1",
      grossCents: 10_000,
    });
    assert.equal(promoMocks.markPromoUsed.mock.calls.length, 1);
  });

  it("aborts with a 409 and releases tickets when the code is exhausted", async () => {
    seedWithOrg(100);
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(false);

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({
        buyerUserId: "buyer-1",
        categoryId: "cat-1",
        promoCode: "TWENTYOFF",
      }),
      /usage limit/,
    );

    for (const ticket of fakeDb.tickets.values()) {
      assert.equal(ticket.status, "available");
    }
    assert.equal(fakeStripe.intents.length, 0);
  });

  it("idempotent replay returns the existing payment WITHOUT re-incrementing the promo", async () => {
    seedWithOrg(100);
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(true);

    const { createPrimaryCheckout } = await import("../payments");
    const first = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      promoCode: "TWENTYOFF",
      idempotencyKey: "idem-promo",
    });
    if ("free" in first) throw new Error("expected a paid checkout");

    assert.equal(promoMocks.validateAndPricePromo.mock.calls.length, 1);
    assert.equal(promoMocks.markPromoUsed.mock.calls.length, 1);

    const replay = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      promoCode: "TWENTYOFF",
      idempotencyKey: "idem-promo",
    });
    if ("free" in replay) throw new Error("expected a paid checkout");

    assert.equal(replay.paymentIntentId, first.paymentIntentId);
    assert.equal(replay.marketplacePaymentId, first.marketplacePaymentId);
    // No second validation and — critically — no second increment.
    assert.equal(promoMocks.validateAndPricePromo.mock.calls.length, 1);
    assert.equal(promoMocks.markPromoUsed.mock.calls.length, 1);
  });

  it("releases the consumed use when the PaymentIntent fails after the increment", async () => {
    seedWithOrg(100);
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(true);
    fakeStripe.failNextIntent = true;

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({
        buyerUserId: "buyer-1",
        categoryId: "cat-1",
        promoCode: "TWENTYOFF",
      }),
      /stripe intent create failed/,
    );

    // The use was consumed before the charge — the abort must return it.
    assert.equal(promoMocks.markPromoUsed.mock.calls.length, 1);
    assert.equal(promoMocks.releasePromoUse.mock.calls.length, 1);
    assert.equal(promoMocks.releasePromoUse.mock.calls[0][0], "promo-1");
    // Tickets released too.
    for (const ticket of fakeDb.tickets.values()) {
      assert.equal(ticket.status, "available");
    }
  });

  it("does NOT release the promo on an exhausted-code abort (nothing was consumed)", async () => {
    seedWithOrg(100);
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(false);

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({
        buyerUserId: "buyer-1",
        categoryId: "cat-1",
        promoCode: "TWENTYOFF",
      }),
      /usage limit/,
    );
    assert.equal(promoMocks.releasePromoUse.mock.calls.length, 0);
  });

  it("idempotent replay after a PaymentIntent failure does NOT return a free claim for a priced checkout", async () => {
    seedWithOrg(100);
    promoMocks.validateAndPricePromo.mockResolvedValue({
      promoCodeId: "promo-1",
      discountCents: 2_000,
    });
    promoMocks.markPromoUsed.mockResolvedValue(true);
    fakeStripe.failNextIntent = true;

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({
        buyerUserId: "buyer-1",
        categoryId: "cat-1",
        promoCode: "TWENTYOFF",
        idempotencyKey: "idem-fail",
      }),
      /stripe intent create failed/,
    );

    // Replay with the same key: a priced checkout that never charged must not
    // be mis-reported as a completed FREE claim. It re-enters the paid path.
    const replay = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      promoCode: "TWENTYOFF",
      idempotencyKey: "idem-fail",
    });
    assert.equal("free" in replay, false);
  });

  it("does not touch the promo when no code is supplied", async () => {
    seedWithOrg(100);
    const { createPrimaryCheckout } = await import("../payments");
    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
    });
    if ("free" in result) throw new Error("expected a paid checkout");

    assert.equal(result.amountTotalCents, 10_000);
    assert.equal(promoMocks.validateAndPricePromo.mock.calls.length, 0);
    assert.equal(promoMocks.markPromoUsed.mock.calls.length, 0);
    const payment = [...fakeDb.payments.values()][0];
    assert.equal(Number(payment.discount_cents), 0);
    assert.equal(payment.promo_code_id, null);
  });
});

describe("createPrimaryCheckout sale window gate", () => {
  beforeEach(() => {
    resetFakeDb();
    fakeStripe.reset();
    promoMocks.validateAndPricePromo.mockReset();
    promoMocks.markPromoUsed.mockReset();
    promoMocks.releasePromoUse.mockReset();
    promoMocks.releasePromoUse.mockResolvedValue(undefined);
  });

  it("rejects with 400 when sales have not started and releases tickets", async () => {
    seedWithOrg(100);
    fakeDb.category.sale_starts_at = new Date(Date.now() + 3_600_000).toISOString();

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({ buyerUserId: "buyer-1", categoryId: "cat-1" }),
      /Sales have not started/,
    );

    for (const ticket of fakeDb.tickets.values()) {
      assert.equal(ticket.status, "available");
    }
    assert.equal(fakeStripe.intents.length, 0);
  });

  it("rejects with 400 when sales have ended and releases tickets", async () => {
    seedWithOrg(100);
    fakeDb.category.sale_ends_at = new Date(Date.now() - 3_600_000).toISOString();

    const { createPrimaryCheckout } = await import("../payments");
    await assert.rejects(
      createPrimaryCheckout({ buyerUserId: "buyer-1", categoryId: "cat-1" }),
      /Sales have ended/,
    );

    for (const ticket of fakeDb.tickets.values()) {
      assert.equal(ticket.status, "available");
    }
    assert.equal(fakeStripe.intents.length, 0);
  });

  it("allows checkout when the window is currently open", async () => {
    seedWithOrg(100);
    fakeDb.category.sale_starts_at = new Date(Date.now() - 3_600_000).toISOString();
    fakeDb.category.sale_ends_at = new Date(Date.now() + 3_600_000).toISOString();

    const { createPrimaryCheckout } = await import("../payments");
    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
    });
    if ("free" in result) throw new Error("expected a paid checkout");
    assert.equal(result.amountTotalCents, 10_000);
  });
});
