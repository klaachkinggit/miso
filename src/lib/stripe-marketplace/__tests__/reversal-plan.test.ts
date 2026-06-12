import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { planProRateReversals } from "../refunds";
import type { MarketplaceTransferRow } from "../transfers";

function mkTransfer(o: Partial<MarketplaceTransferRow> & {
  role: "organizer" | "resale_seller";
  amount: number;
  stripeId?: string | null;
  status?: MarketplaceTransferRow["status"];
}): MarketplaceTransferRow {
  return {
    id: `tr_${o.role}_${o.amount}`,
    marketplace_payment_id: "pay_1",
    recipient_user_id: `u_${o.role}`,
    recipient_role: o.role,
    amount_cents: o.amount,
    currency: "EUR",
    stripe_connected_account_id: `acct_${o.role}`,
    stripe_transfer_id: o.stripeId === undefined ? `tr_stripe_${o.role}` : o.stripeId,
    stripe_transfer_reversal_id: null,
    status: o.status ?? "created",
    failure_reason: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

describe("planProRateReversals", () => {
  it("empty refund returns no steps", () => {
    const plan = planProRateReversals(
      [mkTransfer({ role: "organizer", amount: 100 })],
      0,
    );
    assert.deepEqual(plan, []);
  });

  it("negative refund returns no steps", () => {
    const plan = planProRateReversals(
      [mkTransfer({ role: "organizer", amount: 100 })],
      -50,
    );
    assert.deepEqual(plan, []);
  });

  it("claws back organizer royalty BEFORE resale-seller proceeds", () => {
    const transfers = [
      mkTransfer({ role: "resale_seller", amount: 800 }),
      mkTransfer({ role: "organizer", amount: 200 }),
    ];
    const plan = planProRateReversals(transfers, 300);
    assert.equal(plan.length, 2);
    assert.equal(plan[0].recipientRole, "organizer");
    assert.equal(plan[0].amountCents, 200);
    assert.equal(plan[1].recipientRole, "resale_seller");
    assert.equal(plan[1].amountCents, 100);
  });

  it("caps each step at transfer amount (prorate-min)", () => {
    const plan = planProRateReversals(
      [mkTransfer({ role: "organizer", amount: 100 })],
      500,
    );
    assert.equal(plan.length, 1);
    assert.equal(plan[0].amountCents, 100);
  });

  it("skips transfers without stripe_transfer_id", () => {
    const plan = planProRateReversals(
      [
        mkTransfer({ role: "organizer", amount: 100, stripeId: null }),
        mkTransfer({ role: "resale_seller", amount: 200 }),
      ],
      300,
    );
    assert.equal(plan.length, 1);
    assert.equal(plan[0].recipientRole, "resale_seller");
    assert.equal(plan[0].amountCents, 200);
  });

  it("skips transfers not in created status", () => {
    const plan = planProRateReversals(
      [
        mkTransfer({ role: "organizer", amount: 100, status: "reversed" }),
        mkTransfer({ role: "resale_seller", amount: 200 }),
      ],
      300,
    );
    assert.equal(plan.length, 1);
    assert.equal(plan[0].recipientRole, "resale_seller");
  });

  it("stops early once remaining is satisfied", () => {
    const plan = planProRateReversals(
      [
        mkTransfer({ role: "organizer", amount: 500 }),
        mkTransfer({ role: "resale_seller", amount: 500 }),
      ],
      300,
    );
    assert.equal(plan.length, 1);
    assert.equal(plan[0].amountCents, 300);
  });

  it("sum of plan amounts never exceeds refundCents", () => {
    const plan = planProRateReversals(
      [
        mkTransfer({ role: "organizer", amount: 500 }),
        mkTransfer({ role: "resale_seller", amount: 500 }),
      ],
      750,
    );
    const sum = plan.reduce((acc, s) => acc + s.amountCents, 0);
    assert.equal(sum, 750);
  });

  it("propagates connected account + transfer id for caller", () => {
    const t = mkTransfer({ role: "organizer", amount: 100 });
    const plan = planProRateReversals([t], 100);
    assert.equal(plan[0].stripeConnectedAccountId, "acct_organizer");
    assert.equal(plan[0].stripeTransferId, "tr_stripe_organizer");
    assert.equal(plan[0].transferId, t.id);
  });
});
