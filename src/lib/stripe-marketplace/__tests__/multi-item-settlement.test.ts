import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

import {
  createFakeServiceClient,
  resetFakeDb,
  fakeDb,
} from "./helpers/fake-marketplace";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createFakeServiceClient(),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn().mockResolvedValue(undefined) }));

const mocks = vi.hoisted(() => ({
  fulfillReservedTicket: vi.fn(),
  createTransfersForPayment: vi.fn(),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  fulfillReservedTicket: mocks.fulfillReservedTicket,
}));

vi.mock("../transfers", () => ({
  createTransfersForPayment: mocks.createTransfersForPayment,
}));

vi.mock("@/lib/resale/listing", () => ({
  fulfillResale: vi.fn(),
  ResaleTransferPendingError: class ResaleTransferPendingError extends Error {
    name = "ResaleTransferPendingError";
  },
}));

vi.mock("@/lib/thirdweb/transactions", () => ({
  TransactionTimeoutError: class TransactionTimeoutError extends Error {
    name = "TransactionTimeoutError";
  },
}));

vi.mock("@/lib/chain/ops", () => ({
  ChainOpInFlightError: class ChainOpInFlightError extends Error {
    name = "ChainOpInFlightError";
  },
  ChainOpRepairError: class ChainOpRepairError extends Error {
    name = "ChainOpRepairError";
  },
}));

function seedPaidPayment(quantity: number) {
  const payment = {
    id: "pay-1",
    kind: "primary",
    buyer_user_id: "buyer-1",
    primary_seller_user_id: "org-1",
    organizer_user_id: "org-1",
    purchase_id: null,
    resale_listing_id: null,
    amount_total_cents: 2500 * quantity,
    currency: "EUR",
    marketplace_fee_bps: 500,
    marketplace_fee_cents: 125 * quantity,
    organizer_royalty_bps: 0,
    organizer_royalty_cents: 0,
    primary_seller_cents: 2375 * quantity,
    stripe_payment_intent_id: "pi_1",
    stripe_charge_id: null,
    stripe_transfer_group: "tg_1",
    status: "processing",
    failure_reason: null,
    succeeded_at: null,
    fulfilled_at: null,
    transferred_at: null,
    refunded_at: null,
    disputed_at: null,
    last_webhook_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  fakeDb.payments.set(payment.id, payment as Record<string, unknown>);
  for (let i = 0; i < quantity; i++) {
    const purchaseId = `purchase-${i + 1}`;
    const ticketId = `ticket-${i + 1}`;
    fakeDb.purchases.set(purchaseId, {
      id: purchaseId,
      ticket_id: ticketId,
      buyer_user_id: "buyer-1",
      status: "pending",
      event_id: "event-1",
    });
    fakeDb.items.set(`item-${i + 1}`, {
      id: `item-${i + 1}`,
      marketplace_payment_id: payment.id,
      purchase_id: purchaseId,
      amount_cents: 2500,
      created_at: new Date().toISOString(),
    });
  }
}

describe("settleSucceededPaymentIntent multi-item", () => {
  beforeEach(() => {
    resetFakeDb();
    mocks.fulfillReservedTicket.mockReset();
    mocks.createTransfersForPayment.mockReset();
    mocks.createTransfersForPayment.mockResolvedValue({});
  });

  it("fulfills every item then creates transfers and marks paid", async () => {
    seedPaidPayment(3);
    mocks.fulfillReservedTicket.mockResolvedValue({});
    const { settleSucceededPaymentIntent } = await import("../fulfillment");

    const result = await settleSucceededPaymentIntent({
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
    });

    assert.equal(mocks.fulfillReservedTicket.mock.calls.length, 3);
    const fulfilledTicketIds = mocks.fulfillReservedTicket.mock.calls
      .map((c) => c[0].ticketId)
      .sort();
    assert.deepEqual(fulfilledTicketIds, ["ticket-1", "ticket-2", "ticket-3"]);
    assert.equal(mocks.createTransfersForPayment.mock.calls.length, 1);
    assert.equal(result.status, "paid");
    for (const p of fakeDb.purchases.values()) {
      assert.equal(p.status, "paid");
    }
  });

  it("parks the whole payment in repair_needed with zero transfers when one item fails terminally", async () => {
    seedPaidPayment(3);
    mocks.fulfillReservedTicket
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Ticket missing"))
      .mockResolvedValueOnce({});
    const { settleSucceededPaymentIntent } = await import("../fulfillment");

    const result = await settleSucceededPaymentIntent({
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
    });

    assert.equal(result.status, "repair_needed");
    assert.equal(mocks.createTransfersForPayment.mock.calls.length, 0);
  });
});
