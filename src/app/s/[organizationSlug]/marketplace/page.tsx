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
    <div className="storefront-page pb-20">
      <section className="border-b border-hairline bg-background">
        <div className="container py-12 md:py-16">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <header>
              <p className="eyebrow-signal">{organization.name}</p>
              <h1 className="display mt-4 text-5xl text-foreground md:text-7xl">
                Official
                <br />
                <span className="display-italic text-signal">exchange.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {branding.tagline ??
                  "Verified tickets listed by members. Price-capped, no scalping markup."}
              </p>
            </header>
            <nav
              className="storefront-tabbar"
              aria-label={`${organization.name} storefront sections`}
            >
              <Link href={storefrontPath} className="storefront-tabbar-link">
                Events
              </Link>
              <Link
                href={marketplacePath}
                aria-current="page"
                className="storefront-tabbar-active"
              >
                Exchange
              </Link>
            </nav>
          </div>
        </div>
      </section>
      <main className="container py-10">
        <ResaleListingList
          items={listings}
          listingHref={(item) =>
            storefrontPathForHost(
              organization.slug,
              organizationMarketplaceListingPath(
                organization.slug,
                item.listing.id,
              ),
              `/marketplace/${item.listing.id}`,
              host,
            )
          }
        />
      </main>
    </div>
  );
}
