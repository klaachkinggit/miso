import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

import { createFakeServiceClient, resetFakeDb, fakeDb } from "./helpers/fake-marketplace";

const settleSucceededPaymentIntent = vi.fn(
  async (_args: { paymentIntentId: string; chargeId: string }) => ({}),
);

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createFakeServiceClient(),
}));
vi.mock("../fulfillment", () => ({ settleSucceededPaymentIntent }));
vi.mock("../webhook", () => ({ handleWebhookEvent: vi.fn() }));
vi.mock("../client", () => ({ stripeClient: () => ({}) }));

describe("reDriveStuckPayments", () => {
  beforeEach(() => {
    resetFakeDb();
    settleSucceededPaymentIntent.mockClear();
  });

  it("re-drives stuck payments with a charge and skips those without one", async () => {
    fakeDb.payments.set("p1", {
      id: "p1",
      status: "succeeded",
      stripe_payment_intent_id: "pi_1",
      stripe_charge_id: "ch_1",
      last_webhook_at: null,
    });
    fakeDb.payments.set("p2", {
      id: "p2",
      status: "transfers_pending",
      stripe_payment_intent_id: "pi_2",
      stripe_charge_id: "ch_2",
      last_webhook_at: "2026-01-01T00:00:00.000Z",
    });
    fakeDb.payments.set("p3", {
      id: "p3",
      status: "fulfillment_pending",
      stripe_payment_intent_id: "pi_3",
      stripe_charge_id: null,
      last_webhook_at: null,
    });
    // Not stuck — excluded by the status filter.
    fakeDb.payments.set("p4", {
      id: "p4",
      status: "paid",
      stripe_payment_intent_id: "pi_4",
      stripe_charge_id: "ch_4",
      last_webhook_at: null,
    });

    const { reDriveStuckPayments } = await import("../settlement-sweep");
    const result = await reDriveStuckPayments();

    assert.equal(result.scanned, 3);
    assert.equal(result.reDriven, 2);
    assert.equal(result.errors, 0);
    assert.equal(settleSucceededPaymentIntent.mock.calls.length, 2);
    const intents = settleSucceededPaymentIntent.mock.calls.map(
      (c) => c[0].paymentIntentId,
    );
    assert.deepEqual(new Set(intents), new Set(["pi_1", "pi_2"]));
  });

  it("counts a failed re-drive without aborting the batch", async () => {
    fakeDb.payments.set("p1", {
      id: "p1",
      status: "succeeded",
      stripe_payment_intent_id: "pi_1",
      stripe_charge_id: "ch_1",
      last_webhook_at: null,
    });
    fakeDb.payments.set("p2", {
      id: "p2",
      status: "succeeded",
      stripe_payment_intent_id: "pi_2",
      stripe_charge_id: "ch_2",
      last_webhook_at: null,
    });
    settleSucceededPaymentIntent.mockImplementationOnce(async () => {
      throw new Error("chain timeout");
    });

    const { reDriveStuckPayments } = await import("../settlement-sweep");
    const result = await reDriveStuckPayments();

    assert.equal(result.scanned, 2);
    assert.equal(result.reDriven, 1);
    assert.equal(result.errors, 1);
  });
});
