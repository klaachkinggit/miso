// Organization-first Stripe Connect onboarding.
//
// New platform code owns Stripe state on `organizations`. The v1 Express
// account creation and profile mirrors below are transition adapters only,
// kept in one module so the eventual Accounts v2 migration has one seam.
import { audit } from "@/lib/audit";
import { stripe } from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import type { Organization, Profile } from "@/types/db";
import type Stripe from "stripe";

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

type StripeOrganization = Pick<
  Organization,
  | "id"
  | "name"
  | "organizer_onboarding"
  | "stripe_account_id"
  | "stripe_charges_enabled"
  | "stripe_details_submitted"
  | "stripe_payouts_enabled"
>;

type StripeStatusFlags = Pick<
  ConnectAccountStatus,
  "charges_enabled" | "details_submitted" | "payouts_enabled" | "onboarding_complete"
>;

export function legacyExpressAccountCreateParams(params: {
  profile: Pick<Profile, "id" | "email" | "organizer_onboarding">;
  organization: Pick<StripeOrganization, "id" | "organizer_onboarding"> | null;
}): Stripe.AccountCreateParams {
  const onboarding = ((params.organization?.organizer_onboarding ??
    params.profile.organizer_onboarding ??
    {}) as Partial<OrganizerOnboardingAnswers>);

  return {
    type: "express",
    email: params.profile.email,
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
    metadata: {
      profile_id: params.profile.id,
      ...(params.organization ? { organization_id: params.organization.id } : {}),
    },
  };
}

export function legacyProfileStripeStatusUpdate(params: {
  accountId: string;
  status: StripeStatusFlags;
  currentRole: Profile["role"];
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    stripe_account_id: params.accountId,
    stripe_charges_enabled: params.status.charges_enabled,
    stripe_details_submitted: params.status.details_submitted,
    stripe_payouts_enabled: params.status.payouts_enabled,
  };

  if (params.status.onboarding_complete && params.currentRole === "user") {
    updates.role = "organizer";
  }

  return updates;
}

async function getDefaultStripeOrganization(
  sb: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<StripeOrganization | null> {
  const { data: memberships, error: membershipsError } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .returns<Array<{ organization_id: string }>>();
  if (membershipsError) throw new Error(membershipsError.message);

  const organizationIds = memberships?.map((membership) => membership.organization_id) ?? [];
  if (!organizationIds.length) return null;

  const { data: organizations, error: organizationsError } = await sb
    .from("organizations")
    .select(
      "id, name, organizer_onboarding, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled",
    )
    .in("id", organizationIds)
    .eq("status", "active")
    .returns<StripeOrganization[]>();
  if (organizationsError) throw new Error(organizationsError.message);

  const byId = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  for (const organizationId of organizationIds) {
    const organization = byId.get(organizationId);
    if (organization) return organization;
  }
  return null;
}

export async function ensureConnectAccountForProfile(profile: Profile): Promise<string> {
  const sb = createServiceClient();
  const organization = await getDefaultStripeOrganization(sb, profile.id);
  if (organization?.stripe_account_id) return organization.stripe_account_id;
  if (!organization && profile.stripe_account_id) return profile.stripe_account_id;

  const account = await stripe.accounts.create(
    legacyExpressAccountCreateParams({ profile, organization }),
  );

  if (organization) {
    const { error: organizationError } = await sb
      .from("organizations")
      .update({ stripe_account_id: account.id })
      .eq("id", organization.id);
    if (organizationError) throw organizationError;
  }

  const { error: profileError } = await sb
    .from("profiles")
    .update({ stripe_account_id: account.id })
    .eq("id", profile.id);
  if (profileError) throw profileError;

  await audit({
    actorUserId: profile.id,
    action: "organizer.connect_account_created",
    entityType: organization ? "organization" : "profile",
    entityId: organization?.id ?? profile.id,
    metadata: { account_id: account.id, profile_id: profile.id },
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
  const organization = await getDefaultStripeOrganization(sb, profile.id);
  const accountId = organization?.stripe_account_id ?? profile.stripe_account_id;
  if (!accountId) {
    throw new Error("Organizer has no Stripe Connect account yet");
  }

  const account = await stripe.accounts.retrieve(accountId);
  const charges_enabled = !!account.charges_enabled;
  const details_submitted = !!account.details_submitted;
  const payouts_enabled = !!account.payouts_enabled;
  const onboarding_complete = charges_enabled && details_submitted;

  if (organization) {
    const { error: organizationError } = await sb
      .from("organizations")
      .update({
        stripe_charges_enabled: charges_enabled,
        stripe_details_submitted: details_submitted,
        stripe_payouts_enabled: payouts_enabled,
      })
      .eq("id", organization.id);
    if (organizationError) throw organizationError;
  }

  const updates = legacyProfileStripeStatusUpdate({
    accountId,
    status: { charges_enabled, details_submitted, payouts_enabled, onboarding_complete },
    currentRole: profile.role,
  });

  const { error } = await sb.from("profiles").update(updates).eq("id", profileId);
  if (error) throw error;

  if (onboarding_complete && profile.role === "user") {
    await audit({
      actorUserId: profileId,
      action: "organizer.onboarded",
      entityType: organization ? "organization" : "profile",
      entityId: organization?.id ?? profileId,
      metadata: { account_id: accountId, profile_id: profileId },
    });
  }

  return { charges_enabled, details_submitted, payouts_enabled, onboarding_complete };
}
