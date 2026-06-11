import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
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
    <div className="container py-10">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={storefrontPath}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Events
        </Link>
        <Link
          href={marketplacePath}
          aria-current="page"
          className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
        >
          Exchange
        </Link>
      </div>
      <PageHeader
        title={`${organization.name} exchange`}
        description={branding.tagline ?? "Verified tickets listed by members inside this ticketing channel."}
        className="mb-8"
      />
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
