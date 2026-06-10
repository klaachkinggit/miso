import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ResaleListingList } from "@/components/site/resale-listing-list";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { listSellableResaleListings } from "@/lib/marketplace/public";
import { normalizeOrganizationBranding } from "@/lib/organizations/branding";
import {
  getActiveOrganizationBySlug,
  organizationMarketplaceListingPath,
  organizationMarketplacePath,
  organizationStorefrontPath,
} from "@/lib/organizations/public";
import { storefrontPathForHost } from "@/lib/organizations/hosts";

export const dynamic = "force-dynamic";

export default async function OrganizationMarketplacePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const [{ organizationSlug }, profile, headerStore] = await Promise.all([
    params,
    getCurrentProfile(),
    headers(),
  ]);
  redirectIfCannotUseBuyerSurface(profile);

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const listings = await listSellableResaleListings({
    organizationId: organization.id,
  });
  const branding = normalizeOrganizationBranding(organization.branding);
  const host = headerStore.get("host");
  const storefrontPath = storefrontPathForHost(
    organization.slug,
    organizationStorefrontPath(organization.slug),
    "/",
    host,
  );
  const marketplacePath = storefrontPathForHost(
    organization.slug,
    organizationMarketplacePath(organization.slug),
    "/marketplace",
    host,
  );

  return (
    <div className="container py-12">
      <div className="mb-8 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        <Link
          href={storefrontPath}
          className="rounded-md px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Events
        </Link>
        <Link
          href={marketplacePath}
          aria-current="page"
          className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink"
        >
          Exchange
        </Link>
      </div>
      <header className="mb-10">
        <p className="eyebrow-signal">{organization.name}</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-6xl">
          Official<br />
          <span className="display-italic">exchange.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          {branding.tagline ?? "Verified tickets listed by members. Price-capped, no scalping markup."}
        </p>
      </header>
      <ResaleListingList
        items={listings}
        listingHref={(item) =>
          storefrontPathForHost(
            organization.slug,
            organizationMarketplaceListingPath(organization.slug, item.listing.id),
            `/marketplace/${item.listing.id}`,
            host,
          )
        }
      />
    </div>
  );
}
