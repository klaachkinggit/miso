import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import type { Organization, Profile } from "@/types/db";

export const ACTIVE_ORGANIZATION_COOKIE = "miso_active_organization_id";

export type OrganizationOption = Pick<
  Organization,
  | "id"
  | "name"
  | "slug"
  | "status"
  | "branding"
  | "resale_royalty_enabled"
  | "resale_royalty_bps"
  | "stripe_account_id"
  | "stripe_charges_enabled"
  | "stripe_details_submitted"
>;

export function pickActiveOrganizationId(
  requestedId: string | null | undefined,
  organizations: Array<Pick<OrganizationOption, "id">>,
): string | null {
  if (requestedId && organizations.some((organization) => organization.id === requestedId)) {
    return requestedId;
  }
  return organizations[0]?.id ?? null;
}

export async function getAdminOrganizations(userId: string): Promise<OrganizationOption[]> {
  const sb = createServiceClient();
  const { data: memberships, error: membershipsError } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .returns<Array<{ organization_id: string }>>();
  if (membershipsError) throw new Error(membershipsError.message);

  const organizationIds = memberships?.map((membership) => membership.organization_id) ?? [];
  if (!organizationIds.length) return [];

  const { data: organizations, error: organizationsError } = await sb
    .from("organizations")
    .select(
      "id, name, slug, status, branding, resale_royalty_enabled, resale_royalty_bps, stripe_account_id, stripe_charges_enabled, stripe_details_submitted",
    )
    .in("id", organizationIds)
    .eq("status", "active")
    .returns<OrganizationOption[]>();
  if (organizationsError) throw new Error(organizationsError.message);

  const byId = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  return organizationIds.map((id) => byId.get(id)).filter((organization): organization is OrganizationOption => !!organization);
}

export async function getActiveAdminOrganization(profile: Pick<Profile, "id" | "role">): Promise<{
  organizations: OrganizationOption[];
  activeOrganization: OrganizationOption | null;
}> {
  const organizations = await getAdminOrganizations(profile.id);
  const cookieStore = await cookies();
  const activeId = pickActiveOrganizationId(
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value,
    organizations,
  );
  return {
    organizations,
    activeOrganization: organizations.find((organization) => organization.id === activeId) ?? null,
  };
}

// Single seam for surfaces that require an Active Organization the caller can administer.
// `getAdminOrganizations` already filters by membership role = "admin", so a non-null
// `activeOrganization` is the admin-witness — no second role check needed.
export class ActiveAdminOrganizationRequired extends Error {
  constructor() {
    super("No active organization for this account.");
    this.name = "ActiveAdminOrganizationRequired";
  }
}

export async function requireActiveAdminOrganization(profile: Pick<Profile, "id" | "role">): Promise<{
  organizations: OrganizationOption[];
  activeOrganization: OrganizationOption;
}> {
  const { organizations, activeOrganization } = await getActiveAdminOrganization(profile);
  if (!activeOrganization) throw new ActiveAdminOrganizationRequired();
  return { organizations, activeOrganization };
}

export async function setActiveAdminOrganization(userId: string, organizationId: string): Promise<boolean> {
  const organizations = await getAdminOrganizations(userId);
  if (!organizations.some((organization) => organization.id === organizationId)) return false;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
