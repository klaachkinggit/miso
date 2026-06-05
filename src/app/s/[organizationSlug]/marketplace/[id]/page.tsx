import { notFound, redirect } from "next/navigation";
import { ResaleListingDetail } from "@/components/site/resale-listing-detail";
import { getCurrentProfile } from "@/lib/auth";
import { getSellableResaleListing } from "@/lib/marketplace/public";
import {
  getActiveOrganizationBySlug,
  organizationMarketplaceListingPath,
  organizationMarketplacePath,
} from "@/lib/organizations/public";

export const dynamic = "force-dynamic";

export default async function OrganizationMarketplaceListingPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; id: string }>;
}) {
  const [{ organizationSlug, id }, profile] = await Promise.all([params, getCurrentProfile()]);
  if (profile?.role === "controller") redirect("/controller");

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
      backHref={organizationMarketplacePath(organization.slug)}
      returnPath={organizationMarketplaceListingPath(organization.slug, item.listing.id)}
    />
  );
}
