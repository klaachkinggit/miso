import { PageHeader } from "@/components/site/page-header";
import { ResaleListingList } from "@/components/site/resale-listing-list";
import { listSellableResaleListings } from "@/lib/marketplace/public";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const listings = await listSellableResaleListings();

  return (
    <div className="container py-10">
      <PageHeader
        title="Resale exchange"
        description="Verified digital tickets listed by members through the official MISO anti-scalping marketplace."
        className="mb-8"
      />
      <ResaleListingList
        items={listings}
        listingHref={(item) => `/marketplace/${item.listing.id}`}
      />
    </div>
  );
}
