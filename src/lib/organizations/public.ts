import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Organization } from "@/types/db";

export type PublicOrganization = Pick<
  Organization,
  "id" | "name" | "slug" | "status" | "default_currency" | "branding"
>;

const STOREFRONT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeStorefrontSlug(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!STOREFRONT_SLUG_RE.test(normalized)) return null;
  return normalized;
}

export function organizationStorefrontPath(organizationSlug: string): string {
  return `/s/${encodeURIComponent(organizationSlug)}`;
}

export function organizationEventPath(organizationSlug: string, eventSlug: string): string {
  return `${organizationStorefrontPath(organizationSlug)}/events/${encodeURIComponent(eventSlug)}`;
}

export function organizationMarketplacePath(organizationSlug: string): string {
  return `${organizationStorefrontPath(organizationSlug)}/marketplace`;
}

export function organizationMarketplaceListingPath(organizationSlug: string, listingId: string): string {
  return `${organizationMarketplacePath(organizationSlug)}/${encodeURIComponent(listingId)}`;
}

export async function getActiveOrganizationBySlug(
  rawSlug: string | undefined,
): Promise<PublicOrganization | null> {
  const slug = normalizeStorefrontSlug(rawSlug);
  if (!slug) return null;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organizations")
    .select("id, name, slug, status, default_currency, branding")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<PublicOrganization>();
  if (error) throw new Error(`Organization lookup failed: ${error.message}`);
  return data ?? null;
}
