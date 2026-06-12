import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { reducePaymentTransition } from "../state-machine";
import type { MarketplacePaymentRow } from "../payments";

const FIXED_NOW = "2026-05-17T12:00:00.000Z";
const now = () => FIXED_NOW;

function mkPayment(overrides: Partial<MarketplacePaymentRow> = {}): MarketplacePaymentRow {
  return {
    id: "pay_1",
    kind: "primary",
    buyer_user_id: "buyer",
    primary_seller_user_id: "seller",
    organizer_user_id: "seller",
    purchase_id: "pur_1",
    resale_listing_id: null,
    amount_total_cents: 10_000,
    currency: "EUR",
    marketplace_fee_bps: 500,
    marketplace_fee_cents: 500,
    organizer_royalty_bps: 0,
    organizer_royalty_cents: 0,
    primary_seller_cents: 9_500,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_transfer_group: "tg_1",
    status: "requires_payment",
    failure_reason: null,
    succeeded_at: null,
    fulfilled_at: null,
    transferred_at: null,
    refunded_at: null,
    disputed_at: null,
    last_webhook_at: null,
    ...overrides,
  } as MarketplacePaymentRow;
}

describe("reducePaymentTransition: CHECKOUT_CREATED", () => {
  it("requires_payment → processing with intent id", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "requires_payment" }),
      { type: "CHECKOUT_CREATED", intentId: "pi_123" },
      now,
    );
    assert.equal(plan.patch?.status, "processing");
    assert.equal(plan.patch?.stripe_payment_intent_id, "pi_123");
    assert.equal(plan.sideEffects.mirrorIntentToPurchase, true);
    assert.equal(plan.sideEffects.releaseInventory, false);
  });

  it("idempotent when not in requires_payment", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "processing" }),
      { type: "CHECKOUT_CREATED", intentId: "pi_x" },
      now,
    );
    assert.equal(plan.patch, null);
  });
});

describe("reducePaymentTransition: WEBHOOK_FAILED_ATTEMPT", () => {
  it("does NOT terminalize (Stripe may retry on another PM)", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "processing" }),
      { type: "WEBHOOK_FAILED_ATTEMPT", reason: "card_declined" },
      now,
    );
    assert.equal(plan.patch?.status, undefined);
    assert.equal(plan.patch?.failure_reason, "card_declined");
    assert.equal(plan.sideEffects.releaseInventory, false);
  });

  it("noop when already paid", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "paid" }),
      { type: "WEBHOOK_FAILED_ATTEMPT", reason: "ignored" },
      now,
    );
    assert.equal(plan.patch, null);
  });
});

describe("reducePaymentTransition: WEBHOOK_CANCELED + CHECKOUT_ABORTED", () => {
  it("canceled → failed + releaseInventory", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "processing" }),
      { type: "WEBHOOK_CANCELED", reason: "abandoned" },
      now,
    );
    assert.equal(plan.patch?.status, "failed");
    assert.equal(plan.sideEffects.releaseInventory, true);
  });

  it("aborted → failed + releaseInventory", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "requires_payment" }),
      { type: "CHECKOUT_ABORTED", reason: "client closed" },
      now,
    );
    assert.equal(plan.patch?.status, "failed");
    assert.equal(plan.sideEffects.releaseInventory, true);
  });

  it("noop if already paid", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "paid" }),
      { type: "WEBHOOK_CANCELED", reason: "x" },
      now,
    );
    assert.equal(plan.patch, null);
  });

  it("noop if already failed", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "failed" }),
      { type: "WEBHOOK_CANCELED", reason: "x" },
      now,
    );
    assert.equal(plan.patch, null);
  });

  it("truncates failure_reason to 500 chars", () => {
    const long = "x".repeat(1000);
    const plan = reducePaymentTransition(
      mkPayment({ status: "processing" }),
      { type: "WEBHOOK_CANCELED", reason: long },
      now,
    );
    assert.equal(plan.patch?.failure_reason?.length, 500);
  });
});

describe("reducePaymentTransition: WEBHOOK_SUCCEEDED", () => {
  it("processing → succeeded with charge id", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "processing" }),
      { type: "WEBHOOK_SUCCEEDED", chargeId: "ch_xyz" },
      now,
    );
    assert.equal(plan.patch?.status, "succeeded");
    assert.equal(plan.patch?.stripe_charge_id, "ch_xyz");
    assert.equal(plan.patch?.succeeded_at, FIXED_NOW);
  });

  it("noop when already paid", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "paid" }),
      { type: "WEBHOOK_SUCCEEDED", chargeId: "ch_xyz" },
      now,
    );
    assert.equal(plan.patch, null);
  });

  it("preserves existing succeeded_at across replays", () => {
    const prior = "2026-05-16T00:00:00.000Z";
    const plan = reducePaymentTransition(
      mkPayment({ status: "succeeded", succeeded_at: prior }),
      { type: "WEBHOOK_SUCCEEDED", chargeId: "ch_xyz" },
      now,
    );
    assert.equal(plan.patch?.succeeded_at, prior);
  });
});

describe("reducePaymentTransition: PAID", () => {
  it("sets status=paid + transferred_at + markPurchasePaid side effect", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "transfers_pending" }),
      { type: "PAID" },
      now,
    );
    assert.equal(plan.patch?.status, "paid");
    assert.equal(plan.patch?.transferred_at, FIXED_NOW);
    assert.equal(plan.sideEffects.markPurchasePaid, true);
  });

  it("does NOT mark purchase paid for resale kind", () => {
    const plan = reducePaymentTransition(
      mkPayment({ kind: "resale", purchase_id: null, resale_listing_id: "lst_1" }),
      { type: "PAID" },
      now,
    );
    assert.equal(plan.sideEffects.markPurchasePaid, false);
  });
});

describe("reducePaymentTransition: terminal events", () => {
  it("FULFILLMENT_PENDING → fulfillment_pending", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "succeeded" }),
      { type: "FULFILLMENT_PENDING", reason: "chain timeout" },
      now,
    );
    assert.equal(plan.patch?.status, "fulfillment_pending");
  });

  it("FULFILLMENT_TERMINAL → repair_needed", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "succeeded" }),
      { type: "FULFILLMENT_TERMINAL", reason: "unrecoverable" },
      now,
    );
    assert.equal(plan.patch?.status, "repair_needed");
  });

  it("REFUND_PENDING → refund_pending", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "paid" }),
      { type: "REFUND_PENDING" },
      now,
    );
    assert.equal(plan.patch?.status, "refund_pending");
  });

  it("REFUNDED → refunded + timestamp", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "refund_pending" }),
      { type: "REFUNDED" },
      now,
    );
    assert.equal(plan.patch?.status, "refunded");
    assert.equal(plan.patch?.refunded_at, FIXED_NOW);
  });

  it("DISPUTED → disputed + timestamp", () => {
    const plan = reducePaymentTransition(
      mkPayment({ status: "paid" }),
      { type: "DISPUTED" },
      now,
    );
    assert.equal(plan.patch?.status, "disputed");
    assert.equal(plan.patch?.disputed_at, FIXED_NOW);
  });
});

describe("reducePaymentTransition: side-effect flags only fire for primary+purchase_id", () => {
  it("releaseInventory true for resale failure too", () => {
    const plan = reducePaymentTransition(
      mkPayment({ kind: "resale", purchase_id: null, resale_listing_id: "lst_1" }),
      { type: "WEBHOOK_CANCELED", reason: "x" },
      now,
    );
    assert.equal(plan.sideEffects.releaseInventory, true);
  });

  it("mirrorIntentToPurchase false for resale", () => {
    const plan = reducePaymentTransition(
      mkPayment({ kind: "resale", purchase_id: null, resale_listing_id: "lst_1" }),
      { type: "CHECKOUT_CREATED", intentId: "pi_1" },
      now,
    );
    assert.equal(plan.sideEffects.mirrorIntentToPurchase, false);
  });
});
