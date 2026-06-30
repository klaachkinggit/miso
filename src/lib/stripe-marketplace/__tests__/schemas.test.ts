import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  OnboardingLinkInitSchema,
  PrimaryCheckoutInitSchema,
  ResaleCheckoutInitSchema,
} from "../schemas";

const UUID = "00000000-0000-4000-8000-000000000000";

describe("PrimaryCheckoutInitSchema", () => {
  it("accepts a valid uuid category_id", () => {
    const parsed = PrimaryCheckoutInitSchema.safeParse({ category_id: UUID });
    assert.equal(parsed.success, true);
  });
  it("rejects non-uuid category_id", () => {
    const parsed = PrimaryCheckoutInitSchema.safeParse({ category_id: "abc" });
    assert.equal(parsed.success, false);
  });
  it("rejects missing field", () => {
    const parsed = PrimaryCheckoutInitSchema.safeParse({});
    assert.equal(parsed.success, false);
  });
});

describe("ResaleCheckoutInitSchema", () => {
  it("accepts a valid uuid listing_id", () => {
    const parsed = ResaleCheckoutInitSchema.safeParse({ listing_id: UUID });
    assert.equal(parsed.success, true);
  });
  it("rejects non-uuid listing_id", () => {
    const parsed = ResaleCheckoutInitSchema.safeParse({ listing_id: "x" });
    assert.equal(parsed.success, false);
  });
});

describe("OnboardingLinkInitSchema", () => {
  it("accepts empty body (return_path optional)", () => {
    const parsed = OnboardingLinkInitSchema.safeParse({});
    assert.equal(parsed.success, true);
  });
  it("accepts a leading-slash return_path", () => {
    const parsed = OnboardingLinkInitSchema.safeParse({
      return_path: "/settings/payouts",
    });
    assert.equal(parsed.success, true);
  });
  it("rejects external URLs as return_path (open redirect guard)", () => {
    const parsed = OnboardingLinkInitSchema.safeParse({
      return_path: "https://evil.example.com",
    });
    assert.equal(parsed.success, false);
  });
  it("rejects return_path without leading slash", () => {
    const parsed = OnboardingLinkInitSchema.safeParse({ return_path: "foo" });
    assert.equal(parsed.success, false);
  });
});
