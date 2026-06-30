import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { computePrimaryBreakdown, computeResaleBreakdown } from "../payments";

// Property-level guarantees that bridge fee math to the connected-account
// transfer flow. These don't touch Stripe or the DB — they encode the
// invariants `transfers.ts` relies on (amounts sum to total, fees are
// always positive ints, primary always has zero royalty).

describe("transfer-amount invariants", () => {
  it("primary breakdown produces ONE transfer recipient (organizer)", () => {
    const b = computePrimaryBreakdown({
      grossCents: 5_000,
      marketplaceFeeBps: 500,
    });
    const recipientCount =
      (b.primarySellerCents > 0 ? 1 : 0) +
      (b.organizerRoyaltyCents > 0 ? 1 : 0);
    assert.equal(recipientCount, 1);
  });

  it("resale with royalty=0 produces ONE recipient (resale seller)", () => {
    const b = computeResaleBreakdown({
      grossCents: 5_000,
      marketplaceFeeBps: 500,
      organizerRoyaltyBps: 0,
    });
    const recipientCount =
      (b.primarySellerCents > 0 ? 1 : 0) +
      (b.organizerRoyaltyCents > 0 ? 1 : 0);
    assert.equal(recipientCount, 1);
  });

  it("resale with royalty>0 produces TWO recipients (seller + organizer)", () => {
    const b = computeResaleBreakdown({
      grossCents: 5_000,
      marketplaceFeeBps: 500,
      organizerRoyaltyBps: 500,
    });
    const recipientCount =
      (b.primarySellerCents > 0 ? 1 : 0) +
      (b.organizerRoyaltyCents > 0 ? 1 : 0);
    assert.equal(recipientCount, 2);
  });

  it("all amounts are non-negative integers", () => {
    for (let grossCents = 100; grossCents <= 1_000_000; grossCents *= 10) {
      const b = computeResaleBreakdown({
        grossCents,
        marketplaceFeeBps: 500,
        organizerRoyaltyBps: 250,
      });
      for (const v of [
        b.marketplaceFeeCents,
        b.organizerRoyaltyCents,
        b.primarySellerCents,
      ]) {
        assert.ok(Number.isInteger(v));
        assert.ok(v >= 0);
      }
    }
  });

  it("fee + royalty + seller always equals total (sum invariant)", () => {
    const cases: Array<[number, number, number]> = [
      [1, 500, 0],
      [99, 500, 0],
      [100, 500, 100],
      [333, 500, 250],
      [10_000, 500, 1_000],
      [123_456, 750, 250],
    ];
    for (const [grossCents, fee, royalty] of cases) {
      const b = computeResaleBreakdown({
        grossCents,
        marketplaceFeeBps: fee,
        organizerRoyaltyBps: royalty,
      });
      assert.equal(
        b.marketplaceFeeCents + b.organizerRoyaltyCents + b.primarySellerCents,
        grossCents,
        `sum invariant failed for gross=${grossCents} fee=${fee} royalty=${royalty}`,
      );
    }
  });

  it("seller-amount monotonicity: increasing royalty never grows seller", () => {
    const make = (royaltyBps: number) =>
      computeResaleBreakdown({
        grossCents: 100_000,
        marketplaceFeeBps: 500,
        organizerRoyaltyBps: royaltyBps,
      }).primarySellerCents;
    let prev = make(0);
    for (const r of [100, 250, 500, 1_000, 2_500, 5_000]) {
      const cur = make(r);
      assert.ok(cur <= prev, `seller went up when royalty rose to ${r}`);
      prev = cur;
    }
  });
});
