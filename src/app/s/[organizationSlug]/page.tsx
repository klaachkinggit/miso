import Link from "next/link";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BuyerAssistantWidget } from "@/components/ai/buyer-assistant-widget";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { EventsFilterPanel } from "@/components/site/events-filter-panel";
import { FollowOrganizationButton } from "@/components/site/follow-organization-button";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { isFollowing } from "@/lib/followers";
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
import { getTheme } from "@/lib/organizations/theme";
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
  const [{ organizationSlug }, query, profile, headerStore] = await Promise.all(
    [params, searchParams, getCurrentProfile(), headers()],
  );
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
  const theme = getTheme(organization.theme);
  const accent = branding.accent_color ?? DEFAULT_ORGANIZATION_ACCENT;
  const following = profile
    ? await isFollowing({ organizationId: organization.id, userId: profile.id })
    : false;

  return (
    <div
      className="storefront-page pb-20"
      style={{ "--organization-accent": accent } as CSSProperties}
    >
      <section className="storefront-hero">
        <div className="container storefront-hero-grid">
          <div className="storefront-hero-copy">
            <div className="flex flex-wrap items-center gap-3">
              {branding.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logo_url}
                  alt={`${organization.name} logo`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-md border border-hairline bg-background object-contain p-1"
                />
              ) : null}
              <p className="eyebrow-signal flex items-center gap-2.5">
                <span className="ticker-mark" aria-hidden />
                Official billetterie
              </p>
            </div>
            <h1 className="display storefront-hero-title">
              {organization.name}
              <span className="display-italic text-signal">.</span>
            </h1>
            <p className="storefront-hero-deck">
              {branding.tagline ??
                eventDiscoveryDescription(events.length, discovery)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="#events" className="storefront-primary-link">
                Browse events
              </Link>
              <Link
                href={marketplacePath}
                className="storefront-secondary-link"
              >
                Official exchange
              </Link>
              {profile ? (
                <FollowOrganizationButton
                  organizationSlug={organization.slug}
                  organizationName={organization.name}
                  following={following}
                />
              ) : null}
            </div>
          </div>

          <div
            className="storefront-hero-media"
            aria-hidden={!branding.hero_image_url}
          >
            {branding.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.hero_image_url}
                alt={`${organization.name} storefront artwork`}
                width={1600}
                height={1000}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="storefront-hero-placeholder">
                <span>{theme.label}</span>
                <strong>{events.length || "Soon"}</strong>
                <span>published events</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="events" className="container py-10 md:py-14">
        <div className="mb-8 flex flex-col gap-5 border-b border-hairline pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Program</p>
            <h2 className="display mt-3 text-4xl text-foreground md:text-5xl">
              Tickets on sale.
            </h2>
          </div>
          <nav
            className="storefront-tabbar"
            aria-label={`${organization.name} storefront sections`}
          >
            <Link
              href={basePath}
              aria-current="page"
              className="storefront-tabbar-active"
            >
              Events
            </Link>
            <Link href={marketplacePath} className="storefront-tabbar-link">
              Exchange
            </Link>
          </nav>
        </div>

        <div className="storefront-toolbar mb-6">
          <EventsFilterPanel
            discovery={discovery}
            hasActive={hasActiveFilters(discovery)}
            basePath={basePath}
          />
        </div>

        <div className="-mx-6 mb-10 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
          {EVENT_QUICK_FILTERS.map((filter) => {
            const href =
              filter.key === "all"
                ? basePath
                : `${basePath}?when=${filter.key}`;
            const active = discovery.when === filter.key;
            return (
              <Link
                key={filter.key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  "shrink-0 rounded-full border px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.16em] transition-colors " +
                  (active
                    ? "border-signal bg-signal text-accent-foreground"
                    : "border-hairline bg-card text-muted-foreground hover:border-hairline-strong hover:text-foreground")
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {events.length ? (
          <div className="storefront-event-grid">
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
      </section>

      <BuyerAssistantWidget
        organizationId={organization.id}
        organizationSlug={organization.slug}
      />
    </div>
  );
}
