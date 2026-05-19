import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/db";

export const SITE_SETTINGS_ID = "default";

export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];

export async function loadSiteSettings(): Promise<SiteSettings | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("site_settings")
    .select("*")
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle<SiteSettings>();
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return null;
  if (error) throw error;
  return data;
}

export async function updateSiteSettings(input: {
  landing_hero_bg_url?: string | null;
  landing_audience_url?: string | null;
  landing_dashboard_url?: string | null;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("site_settings").upsert({
    id: SITE_SETTINGS_ID,
    landing_hero_bg_url: input.landing_hero_bg_url ?? null,
    landing_audience_url: input.landing_audience_url ?? null,
    landing_dashboard_url: input.landing_dashboard_url ?? null,
  });
  if (error) throw error;
}
