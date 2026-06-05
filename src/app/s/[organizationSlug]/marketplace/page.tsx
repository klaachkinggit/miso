import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { ResaleListingList } from "@/components/site/resale-listing-list";
import { getCurrentProfile } from "@/lib/auth";
import { listSellableResaleListings } from "@/lib/marketplace/public";
import {
  getActiveOrganizationBySlug,
  organizationMarketplaceListingPath,
  organizationMarketplacePath,
  organizationStorefrontPath,
} from "@/lib/organizations/public";

export const dynamic = "force-dynamic";

export default async function OrganizationMarketplacePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const [{ organizationSlug }, profile] = await Promise.all([params, getCurrentProfile()]);
  if (profile?.role === "controller") redirect("/controller");

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const listings = await listSellableResaleListings({
    organizationId: organization.id,
  });

  return (
    <div className="container py-10">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={organizationStorefrontPath(organization.slug)}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Events
        </Link>
        <Link
          href={organizationMarketplacePath(organization.slug)}
          aria-current="page"
          className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
        >
          Exchange
        </Link>
      </div>
      <PageHeader
        title={`${organization.name} exchange`}
        description="Verified tickets listed by members inside this ticketing channel."
        className="mb-8"
      />
      <ResaleListingList
        items={listings}
        listingHref={(item) => organizationMarketplaceListingPath(organization.slug, item.listing.id)}
      />
    </div>
  );
}
