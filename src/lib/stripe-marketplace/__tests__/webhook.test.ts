import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractChargeId } from "../webhook";
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
