import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  isCorporateIdentifier,
  isSellerPayoutReady,
  OrganizerLegalSchema,
} from "@/lib/organizers/profile";
import type { StripeSellerAccountRow } from "@/lib/stripe-marketplace/seller-accounts";

function seller(
  overrides: Partial<StripeSellerAccountRow> = {},
): StripeSellerAccountRow {
  return {
    id: "seller",
    user_id: "user",
    stripe_account_id: "acct_test",
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    disabled_reason: null,
    requirements_json: null,
    seller_risk_status: "clear",
    last_webhook_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("organizer profile helpers", () => {
  it("accepts SIRET-style and regional corporate identifiers", () => {
    assert.equal(isCorporateIdentifier("123 456 789 00012"), true);
    assert.equal(isCorporateIdentifier("FR-AB123456"), true);
    assert.equal(isCorporateIdentifier("too"), false);
  });

  it("requires either a corporate identifier or explicit no-SIRET declaration", () => {
    assert.equal(
      OrganizerLegalSchema.safeParse({ siret: "", no_siret: false }).success,
      false,
    );
    assert.deepEqual(
      OrganizerLegalSchema.parse({
        siret: "123 456 789 00012",
        no_siret: false,
      }),
      { siret: "123 456 789 00012", no_siret: false },
    );
    assert.deepEqual(
      OrganizerLegalSchema.parse({ siret: "", no_siret: true }),
      { siret: null, no_siret: true },
    );
  });

  it("treats Stripe readiness as charges + payouts + details + clear risk", () => {
    assert.equal(isSellerPayoutReady(seller()), true);
    assert.equal(
      isSellerPayoutReady(seller({ payouts_enabled: false })),
      false,
    );
    assert.equal(
      isSellerPayoutReady(seller({ seller_risk_status: "blocked" })),
      false,
    );
  });
});
