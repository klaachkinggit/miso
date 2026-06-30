import { ResaleListingList } from "@/components/site/resale-listing-list";
import { listSellableResaleListings } from "@/lib/marketplace/public";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const listings = await listSellableResaleListings();

  return (
    <div className="container py-12">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow-signal">Resale · Exchange</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-6xl">
          Official exchange<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Verified digital tickets listed by members. Anti-scalping rules are
          enforced before checkout.
        </p>
      </header>
      <ResaleListingList
        items={listings}
        listingHref={(item) => `/marketplace/${item.listing.id}`}
      />
    </div>
  );
}
