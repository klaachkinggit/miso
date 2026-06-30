import { createServiceClient } from "@/lib/supabase/service";
import { isReservedStorefrontSlug } from "@/lib/organizations/hosts";
import type { Json, Organization } from "@/types/db";

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58)
    .replace(/-+$/g, "");

  return slug.length >= 2 ? slug : "org";
}

export function organizationSlugBaseForRequest(name: string): string {
  const slug = slugifyOrganizationName(name);
  return isReservedStorefrontSlug(slug) ? `${slug}-events` : slug;
}

export async function createOrganizationForAdmin(params: {
  name: string;
  adminUserId: string;
  requestedSlug?: string | null;
  onboarding?: Json | null;
}): Promise<Pick<Organization, "id" | "name" | "slug">> {
  const sb = createServiceClient();
  const baseSlug = organizationSlugBaseForRequest(
    params.requestedSlug || params.name,
  );

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix =
      attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${baseSlug}${suffix}`.slice(0, 63).replace(/-+$/g, "");
    const { data: organization, error } = await sb
      .from("organizations")
      .insert({
        name: params.name.trim(),
        slug,
        created_by_user_id: params.adminUserId,
        organizer_onboarding: params.onboarding ?? null,
      })
      .select("id, name, slug")
      .single<Pick<Organization, "id" | "name" | "slug">>();

    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    if (!organization) throw new Error("Organization could not be created.");

    const { error: membershipError } = await sb
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        user_id: params.adminUserId,
        role: "admin",
      });
    if (membershipError) {
      await sb.from("organizations").delete().eq("id", organization.id);
      throw new Error(membershipError.message);
    }

    return organization;
  }

  throw new Error("Organization slug is already taken.");
}
