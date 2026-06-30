import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

import {
  createFakeServiceClient,
  resetFakeDb,
  fakeDb,
  fakeStripe,
} from "./helpers/fake-marketplace";

const fulfillReservedTicket = vi.fn(
  async ({
    ticketId,
    purchaseId,
  }: {
    ticketId: string;
    purchaseId: string;
  }) => {
    const ticket = fakeDb.tickets.get(ticketId);
    if (ticket) ticket.status = "sold";
    return { ticketId, purchaseId };
  },
);

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
  fulfillReservedTicket,
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

describe("createPrimaryCheckout free-claim + club-table pricing guard", () => {
  beforeEach(() => {
    resetFakeDb();
    fakeStripe.reset();
    fulfillReservedTicket.mockClear();
  });

  it("price-0 general category takes the free-claim path: no intent, no marketplace_payment, tickets fulfilled + purchases paid", async () => {
    fakeDb.seedEvent({ price: 0 });
    const { createPrimaryCheckout } = await import("../payments");

    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 2,
    });

    assert.equal((result as { free?: boolean }).free, true);
    assert.equal((result as { amountTotalCents: number }).amountTotalCents, 0);
    assert.equal(fakeStripe.intents.length, 0);
    assert.equal(fakeDb.payments.size, 0);
    assert.equal(fulfillReservedTicket.mock.calls.length, 2);

    const purchases = [...fakeDb.purchases.values()];
    assert.equal(purchases.length, 2);
    for (const p of purchases) {
      assert.equal(p.status, "paid");
      assert.equal(Number(p.amount), 0);
    }
  });

  it("club table priced 0 with a non-zero online advance is NOT free: charges the advance via a PaymentIntent", async () => {
    fakeDb.seedEvent({ price: 0 });
    fakeDb.category = {
      id: "cat-1",
      currency: "EUR",
      price: 0,
      kind: "club_table",
      name: "Skyline Club Table",
      online_advance: 150,
      extra_guests_enabled: true,
      price_per_extra_guest: 40,
      max_extra_guests: 4,
    };
    const { createPrimaryCheckout } = await import("../payments");

    const result = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 1,
    });

    assert.equal((result as { free?: boolean }).free, undefined);
    assert.equal(fakeStripe.intents.length, 1);
    assert.equal(fakeStripe.intents[0].amount, 15000);
    assert.equal(fakeDb.payments.size, 1);
    assert.equal(fulfillReservedTicket.mock.calls.length, 0);
  });

  it("free-claim idempotent replay returns the same purchases without re-reserving or re-fulfilling", async () => {
    fakeDb.seedEvent({ price: 0 });
    const { createPrimaryCheckout } = await import("../payments");

    const first = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 2,
      idempotencyKey: "free-idem",
    });
    const count = fakeDb.purchases.size;
    const fulfilledCalls = fulfillReservedTicket.mock.calls.length;

    const replay = await createPrimaryCheckout({
      buyerUserId: "buyer-1",
      categoryId: "cat-1",
      quantity: 2,
      idempotencyKey: "free-idem",
    });

    assert.equal((replay as { free?: boolean }).free, true);
    assert.deepEqual(
      new Set((replay as { purchaseIds: string[] }).purchaseIds),
      new Set((first as { purchaseIds: string[] }).purchaseIds),
    );
    assert.equal(fakeDb.purchases.size, count);
    assert.equal(fulfillReservedTicket.mock.calls.length, fulfilledCalls);
  });
});
