import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ResaleListingDetail } from "@/components/site/resale-listing-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { getSellableResaleListing } from "@/lib/marketplace/public";
import {
  getActiveOrganizationBySlug,
  organizationMarketplaceListingPath,
  organizationMarketplacePath,
} from "@/lib/organizations/public";
import { storefrontPathForHost } from "@/lib/organizations/hosts";

export const dynamic = "force-dynamic";

export default async function OrganizationMarketplaceListingPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; id: string }>;
}) {
  const [{ organizationSlug, id }, profile, headerStore] = await Promise.all([
    params,
    getCurrentProfile(),
    headers(),
  ]);
  redirectIfCannotUseBuyerSurface(profile);

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const item = await getSellableResaleListing({
    listingId: id,
    organizationId: organization.id,
  });
  if (!item) notFound();

  return (
    <ResaleListingDetail
      item={item}
      backHref={storefrontPathForHost(
        organization.slug,
        organizationMarketplacePath(organization.slug),
        "/marketplace",
        headerStore.get("host"),
      )}
      returnPath={storefrontPathForHost(
        organization.slug,
        organizationMarketplaceListingPath(organization.slug, item.listing.id),
        `/marketplace/${item.listing.id}`,
        headerStore.get("host"),
      )}
    />
  );
}
