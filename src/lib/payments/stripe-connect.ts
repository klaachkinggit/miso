// Stripe Connect (Express) onboarding for organizers. We provision a
// connected account on signup, send the organizer through Stripe's
// hosted onboarding via an AccountLink, and on return we sync flags
// from the account back onto the profile. Once Stripe confirms
// details_submitted + charges_enabled the profile is promoted to the
// `organizer` role so they can access /admin scoped to their own events.
import { audit } from "@/lib/audit";
import { stripe } from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import type { Profile } from "@/types/db";

function appOrigin(): string {
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  return origin.replace(/\/+$/, "");
}

export interface OrganizerOnboardingAnswers {
  organization_name: string;
  event_types: string;
  expected_monthly_attendees?: string | null;
  country: string;
  website?: string | null;
}

export async function ensureConnectAccountForProfile(profile: Profile): Promise<string> {
  if (profile.stripe_account_id) return profile.stripe_account_id;
  const onboarding = (profile.organizer_onboarding ?? {}) as Partial<OrganizerOnboardingAnswers>;
  const account = await stripe.accounts.create({
    type: "express",
    email: profile.email,
    country: onboarding.country?.toUpperCase() || "FR",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: onboarding.organization_name
      ? {
          name: onboarding.organization_name,
          url: onboarding.website || undefined,
        }
      : undefined,
    metadata: { profile_id: profile.id },
  });

  const sb = createServiceClient();
  const { error } = await sb
    .from("profiles")
    .update({ stripe_account_id: account.id })
    .eq("id", profile.id);
  if (error) throw error;

  await audit({
    actorUserId: profile.id,
    action: "organizer.connect_account_created",
    entityType: "profile",
    entityId: profile.id,
    metadata: { account_id: account.id },
  });

  return account.id;
}

export async function createOrganizerOnboardingLink(accountId: string): Promise<string> {
  const origin = appOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/signup/organizer/stripe?refresh=1`,
    return_url: `${origin}/signup/organizer/complete`,
    type: "account_onboarding",
  });
  return link.url;
}

export interface ConnectAccountStatus {
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
}

export async function syncConnectAccountStatus(profileId: string): Promise<ConnectAccountStatus> {
  const sb = createServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single<Profile>();
  if (!profile) throw new Error("Profile not found");
  if (!profile.stripe_account_id) {
    throw new Error("Organizer has no Stripe Connect account yet");
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  const charges_enabled = !!account.charges_enabled;
  const details_submitted = !!account.details_submitted;
  const payouts_enabled = !!account.payouts_enabled;
  const onboarding_complete = charges_enabled && details_submitted;

  const updates: Record<string, unknown> = {
    stripe_charges_enabled: charges_enabled,
    stripe_details_submitted: details_submitted,
    stripe_payouts_enabled: payouts_enabled,
  };
  // Only promote to organizer workspace access once Stripe
  // confirms the account can accept payments AND the operator has
  // submitted the onboarding form. Until then they remain `user`.
  if (onboarding_complete && profile.role === "user") {
    updates.role = "organizer";
  }

  const { error } = await sb.from("profiles").update(updates).eq("id", profileId);
  if (error) throw error;

  if (onboarding_complete && profile.role === "user") {
    await audit({
      actorUserId: profileId,
      action: "organizer.onboarded",
      entityType: "profile",
      entityId: profileId,
      metadata: { account_id: profile.stripe_account_id },
    });
  }

  return { charges_enabled, details_submitted, payouts_enabled, onboarding_complete };
}
