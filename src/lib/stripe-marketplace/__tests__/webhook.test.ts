import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { extractChargeId, extractChargeRefundInfo } from "../webhook";
import type Stripe from "stripe";

describe("extractChargeId", () => {
  it("returns latest_charge when set (post-2022 shape)", () => {
    const intent = {
      id: "pi_1",
      latest_charge: "ch_modern",
    } as unknown as Stripe.PaymentIntent;
    assert.equal(extractChargeId(intent), "ch_modern");
  });

  it("falls back to charges.data[0].id (legacy shape)", () => {
    const intent = {
      id: "pi_1",
      latest_charge: null,
      charges: { data: [{ id: "ch_legacy" }] },
    } as unknown as Stripe.PaymentIntent;
    assert.equal(extractChargeId(intent), "ch_legacy");
  });

  it("returns null when neither field is populated", () => {
    const intent = {
      id: "pi_1",
      latest_charge: null,
    } as unknown as Stripe.PaymentIntent;
    assert.equal(extractChargeId(intent), null);
  });

  it("returns null when charges.data is empty", () => {
    const intent = {
      id: "pi_1",
      latest_charge: null,
      charges: { data: [] },
    } as unknown as Stripe.PaymentIntent;
    assert.equal(extractChargeId(intent), null);
  });

  it("prefers latest_charge over legacy when both exist", () => {
    const intent = {
      id: "pi_1",
      latest_charge: "ch_new",
      charges: { data: [{ id: "ch_old" }] },
    } as unknown as Stripe.PaymentIntent;
    assert.equal(extractChargeId(intent), "ch_new");
  });
});

describe("extractChargeRefundInfo", () => {
  it("uses charge.amount_refunded as the cumulative refund amount", () => {
    const charge = {
      amount_refunded: 700,
      refunds: { data: [{ id: "re_2", amount: 300 }] },
    } as unknown as Stripe.Charge;
    const info = extractChargeRefundInfo(charge);
    assert.equal(info?.refund.id, "re_2");
    assert.equal(info?.cumulativeRefundedCents, 700);
  });

  it("falls back to the refund amount when charge amount_refunded is missing", () => {
    const charge = {
      refunds: { data: [{ id: "re_1", amount: 300 }] },
    } as unknown as Stripe.Charge;
    const info = extractChargeRefundInfo(charge);
    assert.equal(info?.cumulativeRefundedCents, 300);
  });

  it("returns null when no refund object is embedded", () => {
    const charge = {
      amount_refunded: 300,
      refunds: { data: [] },
    } as unknown as Stripe.Charge;
    assert.equal(extractChargeRefundInfo(charge), null);
  });
});
