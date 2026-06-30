import { describe, expect, it } from "vitest";
import {
  legacyExpressAccountCreateParams,
  legacyProfileStripeStatusUpdate,
} from "@/lib/payments/stripe-connect";
import type { Json, Profile } from "@/types/db";

const onboarding = {
  organization_name: "Boiler Room",
  event_types: "clubs",
  country: "fr",
  website: "https://boiler.example",
} satisfies Json;

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
  organizer_onboarding: onboarding,
} as Pick<Profile, "id" | "email" | "organizer_onboarding">;

describe("legacyExpressAccountCreateParams", () => {
  it("scopes new Connect accounts to the Organization when present", () => {
    const params = legacyExpressAccountCreateParams({
      profile,
      organization: {
        id: "22222222-2222-4222-8222-222222222222",
        organizer_onboarding: onboarding,
      },
    });

    expect(params).toMatchObject({
      type: "express",
      email: "owner@example.com",
      country: "FR",
      business_profile: {
        name: "Boiler Room",
        url: "https://boiler.example",
      },
      metadata: {
        profile_id: profile.id,
        organization_id: "22222222-2222-4222-8222-222222222222",
      },
    });
  });

  it("keeps legacy profile fallback isolated for transition-only accounts", () => {
    const params = legacyExpressAccountCreateParams({
      profile,
      organization: null,
    });

    expect(params.metadata).toEqual({ profile_id: profile.id });
  });
});

describe("legacyProfileStripeStatusUpdate", () => {
  it("mirrors Stripe flags and promotes only completed user profiles", () => {
    expect(
      legacyProfileStripeStatusUpdate({
        accountId: "acct_1",
        currentRole: "user",
        status: {
          charges_enabled: true,
          details_submitted: true,
          payouts_enabled: false,
          onboarding_complete: true,
        },
      }),
    ).toMatchObject({
      stripe_account_id: "acct_1",
      stripe_charges_enabled: true,
      stripe_details_submitted: true,
      stripe_payouts_enabled: false,
      role: "organizer",
    });
  });

  it("does not promote incomplete or already-privileged profiles", () => {
    expect(
      legacyProfileStripeStatusUpdate({
        accountId: "acct_1",
        currentRole: "user",
        status: {
          charges_enabled: false,
          details_submitted: true,
          payouts_enabled: false,
          onboarding_complete: false,
        },
      }),
    ).not.toHaveProperty("role");

    expect(
      legacyProfileStripeStatusUpdate({
        accountId: "acct_1",
        currentRole: "admin",
        status: {
          charges_enabled: true,
          details_submitted: true,
          payouts_enabled: true,
          onboarding_complete: true,
        },
      }),
    ).not.toHaveProperty("role");
  });
});
