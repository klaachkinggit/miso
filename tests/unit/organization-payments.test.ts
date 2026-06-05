import { describe, expect, it } from "vitest";

import {
  assertOrganizationCanAcceptPaidSales,
  organizationCanAcceptPaidSales,
} from "@/lib/organizations/payments";

describe("organization payment readiness", () => {
  it("requires a Stripe account, submitted details, and enabled charges", () => {
    expect(
      organizationCanAcceptPaidSales({
        stripe_account_id: "acct_1",
        stripe_details_submitted: true,
        stripe_charges_enabled: true,
      }),
    ).toBe(true);

    expect(
      organizationCanAcceptPaidSales({
        stripe_account_id: "acct_1",
        stripe_details_submitted: true,
        stripe_charges_enabled: false,
      }),
    ).toBe(false);
  });

  it("throws a buyer-safe domain error when not ready", () => {
    expect(() => assertOrganizationCanAcceptPaidSales(null)).toThrow(
      "This organization cannot accept paid sales until Stripe onboarding is complete.",
    );
  });
});
