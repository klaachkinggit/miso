import { OrganizationBrandingSchema } from "@/lib/schemas";
import type { Json } from "@/types/db";

export type OrganizationBranding = {
  tagline: string | null;
  accent_color: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
};

export const DEFAULT_ORGANIZATION_ACCENT = "#E6D8C9";

function cleanOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function normalizeOrganizationBranding(
  value: unknown,
): OrganizationBranding {
  const raw =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const parsed = OrganizationBrandingSchema.safeParse({
    tagline: cleanOptionalString(
      typeof raw.tagline === "string" ? raw.tagline : null,
    ),
    accent_color: cleanOptionalString(
      typeof raw.accent_color === "string" ? raw.accent_color : null,
    ),
    logo_url: cleanOptionalString(
      typeof raw.logo_url === "string" ? raw.logo_url : null,
    ),
    hero_image_url: cleanOptionalString(
      typeof raw.hero_image_url === "string" ? raw.hero_image_url : null,
    ),
  });
  const data = parsed.success ? parsed.data : {};
  return {
    tagline: cleanOptionalString(data.tagline),
    accent_color: cleanOptionalString(data.accent_color),
    logo_url: cleanOptionalString(data.logo_url),
    hero_image_url: cleanOptionalString(data.hero_image_url),
  };
}

export function organizationBrandingJson(branding: OrganizationBranding): Json {
  return {
    tagline: branding.tagline,
    accent_color: branding.accent_color,
    logo_url: branding.logo_url,
    hero_image_url: branding.hero_image_url,
  };
}
