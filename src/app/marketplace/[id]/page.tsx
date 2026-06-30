import { notFound } from "next/navigation";
import { ResaleListingDetail } from "@/components/site/resale-listing-detail";
import { getSellableResaleListing } from "@/lib/marketplace/public";

export const dynamic = "force-dynamic";

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getSellableResaleListing({ listingId: id });
  if (!item) notFound();

  return <ResaleListingDetail item={item} backHref="/marketplace" />;
}
