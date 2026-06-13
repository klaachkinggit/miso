import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { Organization } from "@/types/db";
import { Hero } from "@/components/landing/hero";
import { ProofStrip } from "@/components/landing/proof-strip";
import { Capabilities } from "@/components/landing/capabilities";
import { DashboardModule } from "@/components/landing/dashboard-module";
import { PricingPaper } from "@/components/landing/pricing-paper";
import { Storefronts, type StorefrontRow } from "@/components/landing/storefronts";
import { FinalCta } from "@/components/landing/final-cta";

// Already runtime-dynamic via cookies (getCurrentProfile), but the service
// client is constructed before Next can detect that, so build-time prerender
// dies without Supabase env. Declare it dynamic so builds are env-independent.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sb = createServiceClient();
  const profile = await getCurrentProfile();
  redirectIfCannotUseBuyerSurface(profile);

  const { data: storefronts } = await sb
    .from("organizations")
    .select("id, name, slug, branding")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<Array<Pick<Organization, "id" | "name" | "slug" | "branding">>>();

  const liveStorefronts: StorefrontRow[] = (storefronts ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    branding: (s.branding ?? null) as { logo_url?: string | null } | null,
  }));

  return (
    <div className="pb-24 md:pb-0">
      <Hero />
      <ProofStrip />
      <Capabilities />
      <DashboardModule />
      <PricingPaper />
      <Storefronts storefronts={liveStorefronts} />
      <FinalCta />
    </div>
  );
}
