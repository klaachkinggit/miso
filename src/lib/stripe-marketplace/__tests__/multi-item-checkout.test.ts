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
  assertPayoutReady: vi
    .fn()
    .mockResolvedValue({ stripe_account_id: "acct_org" }),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  reserveTicket: vi.fn(async ({ buyerUserId }: { buyerUserId: string }) => {
    const ticket = fakeDb.reserveNextTicket(buyerUserId);
    return { ticket, category: fakeDb.category };
  }),
  releaseReservation: vi.fn(async (id: string) => fakeDb.releaseTicket(id)),
}));

vi.mock("@/lib/payments/checkout", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/payments/checkout")
  >("@/lib/payments/checkout");
  return {
    ...actual,
    resolveGiftRecipientUserId: vi.fn().mockResolvedValue(null),
  };
});

describe("createPrimaryCheckout multi-item", () => {
  beforeEach(() => {
    resetFakeDb();
    fakeStripe.reset();
  });

  it("creates N purchases + N items + one intent with the summed amount", async () => {
    fakeDb.seedEvent({ price: 25 });
    const { createPrimaryCheckout } = await import("../payments");

    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 3,
    });
    if ("free" in result) throw new Error("expected a paid checkout");

    const purchases = [...fakeDb.purchases.values()];
    assert.equal(purchases.length, 3);
    for (const p of purchases) {
      assert.equal(p.status, "pending");
      assert.equal(Number(p.amount), 25);
    }

    const items = [...fakeDb.items.values()];
    assert.equal(items.length, 3);
    const itemTotal = items.reduce((sum, i) => sum + Number(i.amount_cents), 0);
    assert.equal(itemTotal, 7500);

    const payment = [...fakeDb.payments.values()][0];
    assert.equal(payment.purchase_id, null);
    assert.equal(Number(payment.amount_total_cents), 7500);
    assert.equal(payment.kind, "primary");

    assert.equal(fakeStripe.intents.length, 1);
    assert.equal(fakeStripe.intents[0].amount, 7500);
    assert.equal(fakeStripe.intents[0].metadata.quantity, "3");
    assert.equal(
      fakeStripe.intents[0].metadata.marketplace_payment_id,
      payment.id,
    );
    assert.equal(fakeStripe.intents[0].metadata.purchase_id, undefined);
    assert.equal(fakeStripe.intents[0].metadata.ticket_id, undefined);

    assert.equal(result.amountTotalCents, 7500);
    assert.equal(result.marketplacePaymentId, payment.id);
  });

  it("rolls back every reserved ticket + purchase when a later step fails", async () => {
    fakeDb.seedEvent({ price: 25 });
    fakeStripe.failNextIntent = true;
    const { createPrimaryCheckout } = await import("../payments");

    await assert.rejects(
      createPrimaryCheckout({
        buyerUserId: "buyer-1",
        categoryId: "cat-1",
        quantity: 2,
      }),
    );

    for (const ticket of fakeDb.tickets.values()) {
      assert.equal(ticket.status, "available");
      assert.equal(ticket.owner_user_id, null);
    }
    for (const p of fakeDb.purchases.values()) {
      assert.equal(p.status, "failed");
    }
  });

  it("idempotent replay returns the same intent without new reservations", async () => {
    fakeDb.seedEvent({ price: 25 });
    const { createPrimaryCheckout } = await import("../payments");

    const first = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 2,
      idempotencyKey: "idem-1",
    });
    if ("free" in first) throw new Error("expected a paid checkout");

    const purchaseCount = fakeDb.purchases.size;
    const ticketsReserved = [...fakeDb.tickets.values()].filter(
      (t) => t.status === "reserved",
    ).length;
    const intentCount = fakeStripe.intents.length;

    const replay = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 2,
      idempotencyKey: "idem-1",
    });
    if ("free" in replay) throw new Error("expected a paid checkout");

    assert.equal(replay.paymentIntentId, first.paymentIntentId);
    assert.equal(replay.marketplacePaymentId, first.marketplacePaymentId);
    assert.equal(fakeDb.purchases.size, purchaseCount);
    assert.equal(
      [...fakeDb.tickets.values()].filter((t) => t.status === "reserved")
        .length,
      ticketsReserved,
    );
    assert.equal(fakeStripe.intents.length, intentCount);
  });
});
