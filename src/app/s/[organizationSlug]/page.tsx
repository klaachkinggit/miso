import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { EventsFilterPanel } from "@/components/site/events-filter-panel";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import {
  EVENT_QUICK_FILTERS,
  eventDiscoveryDescription,
  hasActiveFilters,
  normalizeEventDiscoveryParams,
} from "@/lib/events/discovery";
import { listPublishedEvents } from "@/lib/events/public";
import {
  DEFAULT_ORGANIZATION_ACCENT,
  normalizeOrganizationBranding,
} from "@/lib/organizations/branding";
import {
  getActiveOrganizationBySlug,
  organizationEventPath,
  organizationMarketplacePath,
  organizationStorefrontPath,
} from "@/lib/organizations/public";
import { storefrontPathForHost } from "@/lib/organizations/hosts";

type RawSearchParams = {
  when?: string;
  q?: string;
  city?: string;
  genre?: string;
  vibe?: string;
  price?: string;
  festival?: string;
  sort?: string;
};

export default async function OrganizationStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams?: Promise<RawSearchParams>;
}) {
  const [{ organizationSlug }, query, profile, headerStore] = await Promise.all([
    params,
    searchParams,
    getCurrentProfile(),
    headers(),
  ]);
  redirectIfCannotUseBuyerSurface(profile);

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const host = headerStore.get("host");
  const basePath = storefrontPathForHost(
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
  const discovery = normalizeEventDiscoveryParams(query);
  const events = await listPublishedEvents({
    discovery,
    organizationId: organization.id,
  });
  const branding = normalizeOrganizationBranding(organization.branding);
  const accent = branding.accent_color ?? DEFAULT_ORGANIZATION_ACCENT;

  return (
    <div className="container py-8 pb-20 md:py-12 md:pb-12">
      <section className="relative mb-6 min-h-64 overflow-hidden rounded-lg border border-border/70 bg-card">
        {branding.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="relative flex min-h-64 max-w-3xl flex-col justify-end gap-4 p-6 md:p-8">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={`${organization.name} logo`}
              className="h-16 w-16 rounded-md border border-border/60 object-contain"
            />
          ) : null}
          <div>
            <p className="mono-stub mb-2" style={{ color: accent }}>
              Official billeterie
            </p>
            <h1 className="display text-4xl md:text-6xl">{organization.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              {branding.tagline ?? eventDiscoveryDescription(events.length, discovery)}
            </p>
          </div>
        </div>
      </section>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={basePath}
          aria-current="page"
          className="rounded-full px-3 py-1 text-xs font-semibold text-[#121212]"
          style={{ backgroundColor: accent }}
        >
          Events
        </Link>
        <Link
          href={marketplacePath}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Exchange
        </Link>
      </div>

      <div className="mb-6">
        <EventsFilterPanel
          discovery={discovery}
          hasActive={hasActiveFilters(discovery)}
          basePath={basePath}
        />
      </div>

      <div className="-mx-6 mb-8 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {EVENT_QUICK_FILTERS.map((filter) => {
          const href = filter.key === "all" ? basePath : `${basePath}?when=${filter.key}`;
          return (
            <Link
              key={filter.key}
              href={href}
              aria-current={discovery.when === filter.key ? "page" : undefined}
              className={
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
                (discovery.when === filter.key
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {events.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              href={
                event.slug
                  ? storefrontPathForHost(
                      organization.slug,
                      organizationEventPath(organization.slug, event.slug),
                      `/events/${event.slug}`,
                      host,
                    )
                  : `/events/${event.id}`
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events match your filters"
          description={
            hasActiveFilters(discovery)
              ? "Try clearing some filters or widening your search."
              : "New ticket drops will be published soon."
          }
        />
      )}
    </div>
  );
}
