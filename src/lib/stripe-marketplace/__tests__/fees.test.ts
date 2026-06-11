import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePrimaryBreakdown,
  computeResaleBreakdown,
  fromCents,
  toCents,
} from "../payments";

describe("toCents/fromCents", () => {
  it("converts numeric major units to integer cents", () => {
    assert.equal(toCents(0), 0);
    assert.equal(toCents(1), 100);
    assert.equal(toCents(1.23), 123);
    assert.equal(toCents("4.56"), 456);
    assert.equal(toCents(0.1 + 0.2), 30); // rounds JS float drift
  });

  it("rejects negative / NaN", () => {
    assert.throws(() => toCents(-1));
    assert.throws(() => toCents(Number.NaN));
  });

  it("round-trips fromCents", () => {
    assert.equal(fromCents(100), 1);
    assert.equal(fromCents(12345), 123.45);
  });
});

describe("computePrimaryBreakdown", () => {
  it("splits at 5% marketplace fee", () => {
    const result = computePrimaryBreakdown({
      grossCents: 10_000,
      marketplaceFeeBps: 500,
    });
    assert.equal(result.amountTotalCents, 10_000);
    assert.equal(result.marketplaceFeeCents, 500);
    assert.equal(result.primarySellerCents, 9_500);
    assert.equal(result.organizerRoyaltyCents, 0);
  });

  it("rounds fee down so seller never goes negative", () => {
    // 1cent gross * 5% = 0.05 cent → floor 0
    const result = computePrimaryBreakdown({
      grossCents: 1,
      marketplaceFeeBps: 500,
    });
    assert.equal(result.marketplaceFeeCents, 0);
    assert.equal(result.primarySellerCents, 1);
  });

  it("rejects zero gross (marketplace settlement requires > 0)", () => {
    assert.throws(() =>
      computePrimaryBreakdown({ grossCents: 0, marketplaceFeeBps: 500 }),
    );
  });

  it("rejects fees outside 0..10000 bps", () => {
    assert.throws(() =>
      computePrimaryBreakdown({ grossCents: 100, marketplaceFeeBps: -1 }),
    );
    assert.throws(() =>
      computePrimaryBreakdown({ grossCents: 100, marketplaceFeeBps: 10_001 }),
    );
  });
});

describe("computeResaleBreakdown", () => {
  it("splits at 5% fee + 0% royalty", () => {
    const result = computeResaleBreakdown({
      grossCents: 10_000,
      marketplaceFeeBps: 500,
      organizerRoyaltyBps: 0,
    });
    assert.equal(result.marketplaceFeeCents, 500);
    assert.equal(result.organizerRoyaltyCents, 0);
    assert.equal(result.primarySellerCents, 9_500);
  });

  it("splits at 5% fee + 10% organizer royalty", () => {
    const result = computeResaleBreakdown({
      grossCents: 10_000,
      marketplaceFeeBps: 500,
      organizerRoyaltyBps: 1000,
    });
    assert.equal(result.marketplaceFeeCents, 500);
    assert.equal(result.organizerRoyaltyCents, 1_000);
    assert.equal(result.primarySellerCents, 8_500);
    assert.equal(
      result.amountTotalCents,
      result.marketplaceFeeCents +
        result.organizerRoyaltyCents +
        result.primarySellerCents,
    );
  });

  it("rejects fee + royalty > 100%", () => {
    assert.throws(() =>
      computeResaleBreakdown({
        grossCents: 10_000,
        marketplaceFeeBps: 6000,
        organizerRoyaltyBps: 6000,
      }),
    );
  });

  it("absorbs rounding remainder into seller proceeds", () => {
    // 333 cents * 5% = 16.65 → floor 16; royalty 0; seller = 333 - 16 = 317
    const result = computeResaleBreakdown({
      grossCents: 333,
      marketplaceFeeBps: 500,
      organizerRoyaltyBps: 0,
    });
    assert.equal(result.marketplaceFeeCents, 16);
    assert.equal(result.primarySellerCents, 317);
    assert.equal(
      result.amountTotalCents,
      result.marketplaceFeeCents +
        result.organizerRoyaltyCents +
        result.primarySellerCents,
    );
  });

  it("never produces a negative seller amount with extreme bps", () => {
    // royalty 9999 + fee 1 = 10000 → primary = 0
    const result = computeResaleBreakdown({
      grossCents: 10_000,
      marketplaceFeeBps: 1,
      organizerRoyaltyBps: 9_999,
    });
    assert.ok(result.primarySellerCents >= 0);
  });
});
