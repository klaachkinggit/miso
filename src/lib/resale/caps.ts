// Per-country resale price caps (P1.7).
//
// An organization sells in one jurisdiction (`organizations.country_code`).
// Some jurisdictions legislate a hard ceiling on resale markup (e.g. FR caps
// at face value + 10%). Those legal ceilings live in `resale_price_caps`
// keyed by country and OVERRIDE the org's own discretionary cap. Where no
// country row exists, the org's `resale_cap_bps` applies. Absent both, resale
// is face-value only (0 bps markup).

import { createServiceClient } from "@/lib/supabase/service";
import type { Organization, ResalePriceCap } from "@/types/db";

export async function resolveResaleCapBps(params: {
  organizationId: string;
}): Promise<number> {
  const sb = createServiceClient();

  const { data: org } = await sb
    .from("organizations")
    .select("country_code, resale_cap_bps")
    .eq("id", params.organizationId)
    .maybeSingle<Pick<Organization, "country_code" | "resale_cap_bps">>();
  if (!org) return 0;

  if (org.country_code) {
    const { data: countryCap } = await sb
      .from("resale_price_caps")
      .select("cap_bps")
      .eq("country_code", org.country_code)
      .maybeSingle<Pick<ResalePriceCap, "cap_bps">>();
    if (countryCap) return countryCap.cap_bps;
  }

  return org.resale_cap_bps ?? 0;
}

// Cents-safe ceiling: face value plus `capBps` basis points of markup,
// floored to whole cents. cap 0 → face value exactly.
export function maxResalePrice(originalOnlineTotal: number, capBps: number): number {
  const cents = Math.round(originalOnlineTotal * 100);
  const maxCents = Math.floor((cents * (10000 + capBps)) / 10000);
  return maxCents / 100;
}
