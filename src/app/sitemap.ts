import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { organizationStorefrontOrigin } from "@/lib/organizations/hosts";
import { getConfiguredAppUrl } from "@/lib/url";

const siteUrl = getConfiguredAppUrl();

export const revalidate = 3600;

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

type SitemapEvent = {
  id: string;
  organization_id: string | null;
  slug: string | null;
  date: string | null;
  updated_at?: string | null;
};

type SitemapOrganization = {
  id: string;
  slug: string;
  updated_at?: string | null;
};

function page(
  url: string,
  priority: number,
  changeFrequency: "daily" | "weekly" | "monthly",
) {
  return {
    url: `${siteUrl}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  };
}

function organizationPageUrl(organizationSlug: string, path = ""): string {
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    return `${siteUrl}/s/${organizationSlug}${path}`;
  }
  return `${organizationStorefrontOrigin(organizationSlug)}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    page("/", 1, "daily"),
    page("/events", 0.9, "daily"),
    page("/signup", 0.6, "monthly"),
    page("/login", 0.4, "monthly"),
    page("/legal/terms", 0.2, "monthly"),
    page("/legal/privacy", 0.2, "monthly"),
    page("/legal/cookies", 0.2, "monthly"),
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || isLocalSupabaseUrl(supabaseUrl)) {
    return staticPages;
  }

  try {
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const [{ data: events }, { data: organizations }] = await Promise.all([
      sb
        .from("events")
        .select("id,organization_id,slug,date,updated_at")
        .eq("status", "published")
        .order("date", { ascending: true })
        .limit(500)
        .returns<SitemapEvent[]>(),
      sb
        .from("organizations")
        .select("id,slug,updated_at")
        .eq("status", "active")
        .limit(200)
        .returns<SitemapOrganization[]>(),
    ]);

    const organizationById = new Map(
      (organizations ?? []).map((organization) => [
        organization.id,
        organization,
      ]),
    );
    const publicEvents =
      events?.filter(
        (event) =>
          !event.organization_id || organizationById.has(event.organization_id),
      ) ?? [];
    const organizationPages =
      organizations?.flatMap((organization) => [
        {
          url: organizationPageUrl(organization.slug),
          lastModified: organization.updated_at ?? new Date(),
          changeFrequency: "daily" as const,
          priority: 0.8,
        },
        {
          url: organizationPageUrl(organization.slug, "/marketplace"),
          lastModified: organization.updated_at ?? new Date(),
          changeFrequency: "daily" as const,
          priority: 0.6,
        },
      ]) ?? [];

    const eventPages = publicEvents.map((event) => ({
      url: `${siteUrl}/events/${event.id}`,
      lastModified: event.updated_at ?? event.date ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const organizationEventPages = publicEvents
      .map((event) => {
        const organization = organizationById.get(event.organization_id ?? "");
        if (!organization || !event.slug) return null;
        return {
          url: organizationPageUrl(organization.slug, `/events/${event.slug}`),
          lastModified: event.updated_at ?? event.date ?? new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return [
      ...staticPages,
      ...organizationPages,
      ...eventPages,
      ...organizationEventPages,
    ];
  } catch {
    return staticPages;
  }
}
