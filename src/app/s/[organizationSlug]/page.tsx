import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
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
  const following = profile
    ? await isFollowing({ organizationId: organization.id, userId: profile.id })
    : false;

  return (
    <div className="container py-10 pb-20 md:py-14">
      <section className="relative mb-10 overflow-hidden rounded-md border border-hairline bg-ink-raised">
        {branding.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-65"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ backgroundColor: accent, opacity: 0.4 }} />
        <div className="relative flex min-h-72 max-w-3xl flex-col justify-end gap-5 p-8 md:p-12">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={`${organization.name} logo`}
              className="h-16 w-16 rounded-md border border-hairline object-contain"
            />
          ) : null}
          <div>
            <p className="eyebrow mb-3 flex items-center gap-2.5" style={{ color: accent }}>
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accent, boxShadow: `0 0 0 4px ${accent}33` }}
              />
              Official storefront
            </p>
            <h1 className="display text-5xl text-foreground md:text-7xl">
              {organization.name}<span className="display-italic" style={{ color: accent }}>.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {branding.tagline ?? eventDiscoveryDescription(events.length, discovery)}
            </p>
            {profile ? (
              <div className="mt-6">
                <FollowOrganizationButton
                  organizationSlug={organization.slug}
                  organizationName={organization.name}
                  following={following}
                  accent={accent}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mb-8 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        <Link
          href={basePath}
          aria-current="page"
          className="rounded-md px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink"
          style={{ backgroundColor: accent }}
        >
          Events
        </Link>
        <Link
          href={marketplacePath}
          className="rounded-md px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
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

      <div className="-mx-6 mb-10 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {EVENT_QUICK_FILTERS.map((filter) => {
          const href = filter.key === "all" ? basePath : `${basePath}?when=${filter.key}`;
          const active = discovery.when === filter.key;
          return (
            <Link
              key={filter.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "shrink-0 rounded-full border px-4 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.16em] transition-colors " +
                (active
                  ? "border-foreground bg-foreground text-ink"
                  : "border-hairline bg-transparent text-muted-foreground hover:border-hairline-strong hover:text-foreground")
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
