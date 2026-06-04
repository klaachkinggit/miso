import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const siteUrl =
  (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3002").replace(
    /\/+$/,
    "",
  );

export const revalidate = 3600;

type SitemapEvent = {
  id: string;
  date: string | null;
  updated_at?: string | null;
};

function page(url: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly") {
  return {
    url: `${siteUrl}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    page("/", 1, "daily"),
    page("/events", 0.9, "daily"),
    page("/marketplace", 0.8, "daily"),
    page("/signup", 0.6, "monthly"),
    page("/login", 0.4, "monthly"),
    page("/legal/terms", 0.2, "monthly"),
    page("/legal/privacy", 0.2, "monthly"),
    page("/legal/cookies", 0.2, "monthly"),
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return staticPages;
  }

  try {
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: events } = await sb
      .from("events")
      .select("id,date,updated_at")
      .eq("status", "published")
      .order("date", { ascending: true })
      .limit(500)
      .returns<SitemapEvent[]>();

    const eventPages =
      events?.map((event) => ({
        url: `${siteUrl}/events/${event.id}`,
        lastModified: event.updated_at ?? event.date ?? new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })) ?? [];

    return [...staticPages, ...eventPages];
  } catch {
    return staticPages;
  }
}
