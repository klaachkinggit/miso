import { afterEach, describe, expect, it } from "vitest";
import {
  resalePlatformFee,
  resaleRoyaltyAmount,
  resaleStripeFeeAmount,
} from "@/lib/resale/pricing";

const ORIGINAL_PERCENT = process.env.MISO_RESALE_PLATFORM_FEE_PERCENT;
const ORIGINAL_FIXED = process.env.MISO_RESALE_PLATFORM_FEE_FIXED;
const ORIGINAL_STRIPE_PERCENT = process.env.MISO_STRIPE_FEE_PERCENT;
const ORIGINAL_STRIPE_FIXED = process.env.MISO_STRIPE_FEE_FIXED;

afterEach(() => {
  if (ORIGINAL_PERCENT === undefined) {
    delete process.env.MISO_RESALE_PLATFORM_FEE_PERCENT;
  } else {
    process.env.MISO_RESALE_PLATFORM_FEE_PERCENT = ORIGINAL_PERCENT;
  }
  if (ORIGINAL_FIXED === undefined) {
    delete process.env.MISO_RESALE_PLATFORM_FEE_FIXED;
  } else {
    process.env.MISO_RESALE_PLATFORM_FEE_FIXED = ORIGINAL_FIXED;
  }
  if (ORIGINAL_STRIPE_PERCENT === undefined) {
    delete process.env.MISO_STRIPE_FEE_PERCENT;
  } else {
    process.env.MISO_STRIPE_FEE_PERCENT = ORIGINAL_STRIPE_PERCENT;
  }
  if (ORIGINAL_STRIPE_FIXED === undefined) {
    delete process.env.MISO_STRIPE_FEE_FIXED;
  } else {
    process.env.MISO_STRIPE_FEE_FIXED = ORIGINAL_STRIPE_FIXED;
  }
});

describe("resalePlatformFee", () => {
  it("defaults to a 5 percent buyer-paid platform fee", () => {
    delete process.env.MISO_RESALE_PLATFORM_FEE_PERCENT;
    delete process.env.MISO_RESALE_PLATFORM_FEE_FIXED;

    expect(resalePlatformFee(100)).toBe(5);
  });

  it("supports configured percent plus fixed fee", () => {
    process.env.MISO_RESALE_PLATFORM_FEE_PERCENT = "7.5";
    process.env.MISO_RESALE_PLATFORM_FEE_FIXED = "1.25";

    expect(resalePlatformFee(200)).toBe(16.25);
  });

  it("rounds to cents", () => {
    process.env.MISO_RESALE_PLATFORM_FEE_PERCENT = "2.9";
    process.env.MISO_RESALE_PLATFORM_FEE_FIXED = "0";

    expect(resalePlatformFee(33.33)).toBe(0.97);
  });

  it("ignores invalid env values instead of producing NaN", () => {
    process.env.MISO_RESALE_PLATFORM_FEE_PERCENT = "bad";
    process.env.MISO_RESALE_PLATFORM_FEE_FIXED = "also-bad";

    expect(resalePlatformFee(100)).toBe(0);
  });
});

describe("resaleRoyaltyAmount", () => {
  it("returns zero when disabled", () => {
    expect(
      resaleRoyaltyAmount({ sellerAmount: 100, enabled: false, bps: 500 }),
    ).toBe(0);
  });

  it("calculates enabled royalty in basis points", () => {
    expect(
      resaleRoyaltyAmount({ sellerAmount: 100, enabled: true, bps: 500 }),
    ).toBe(5);
  });

  it("rounds royalty to cents", () => {
    expect(
      resaleRoyaltyAmount({ sellerAmount: 33.33, enabled: true, bps: 333 }),
    ).toBe(1.11);
  });
});

describe("resaleStripeFeeAmount", () => {
  it("grosses up Stripe processing on seller price plus MISO fee plus royalty", () => {
    delete process.env.MISO_STRIPE_FEE_PERCENT;
    delete process.env.MISO_STRIPE_FEE_FIXED;

    expect(
      resaleStripeFeeAmount({
        sellerAmount: 50,
        platformFeeAmount: 2.5,
        royaltyAmount: 5,
      }),
    ).toBe(1.13);
  });

  it("keeps zero-value resale free", () => {
    expect(
      resaleStripeFeeAmount({
        sellerAmount: 0,
        platformFeeAmount: 0,
        royaltyAmount: 0,
      }),
    ).toBe(0);
  });
});
