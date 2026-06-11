import { describe, expect, it } from "vitest";
import {
  hasOrganizationDeletionActivity,
  organizationDeletionBlocker,
  type OrganizationDeletionActivity,
} from "@/lib/organizations/ownership";

const emptyActivity: OrganizationDeletionActivity = {
  events: 0,
  purchases: 0,
  resaleListings: 0,
  customers: 0,
};

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Boiler Room",
  slug: "boiler-room",
  stripe_account_id: null,
};

describe("Organization ownership", () => {
  it("allows deleting an empty Organization with exact confirmation", () => {
    expect(
      organizationDeletionBlocker({
        organization,
        confirmedOrganizationId: organization.id,
        confirmedName: organization.name,
        activity: emptyActivity,
      }),
    ).toBeNull();
  });

  it("blocks delete when confirmation targets another Organization", () => {
    expect(
      organizationDeletionBlocker({
        organization,
        confirmedOrganizationId: "22222222-2222-4222-8222-222222222222",
        confirmedName: organization.name,
        activity: emptyActivity,
      }),
    ).toBe("Delete request does not match active Organization.");
  });

  it("blocks delete when confirmation name is not exact", () => {
    expect(
      organizationDeletionBlocker({
        organization,
        confirmedOrganizationId: organization.id,
        confirmedName: "boiler room",
        activity: emptyActivity,
      }),
    ).toBe("Type the Organization name exactly to delete it.");
  });

  it("blocks delete when Stripe account is linked", () => {
    expect(
      organizationDeletionBlocker({
        organization: { ...organization, stripe_account_id: "acct_123" },
        confirmedOrganizationId: organization.id,
        confirmedName: organization.name,
        activity: emptyActivity,
      }),
    ).toBe("Organization has a Stripe account and cannot be deleted.");
  });

  it("blocks delete when any Organization activity exists", () => {
    const activity = {
      ...emptyActivity,
      resaleListings: 1,
    };

    expect(hasOrganizationDeletionActivity(activity)).toBe(true);
    expect(
      organizationDeletionBlocker({
        organization,
        confirmedOrganizationId: organization.id,
        confirmedName: organization.name,
        activity,
      }),
    ).toBe("Organization has activity and cannot be deleted.");
  });
});
