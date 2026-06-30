import Link from "next/link";
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const [params, profile] = await Promise.all([
    searchParams,
    getCurrentProfile(),
  ]);
  const discovery = normalizeEventDiscoveryParams(params);
  redirectIfCannotUseBuyerSurface(profile);

  const events = await listPublishedEvents({ discovery });

  return (
    <div className="container py-12 pb-20 md:py-16 md:pb-12">
      <header className="mb-10 border-b border-hairline pb-10">
        <p className="eyebrow-signal">Explore</p>
        <h1 className="display mt-4 text-5xl text-foreground md:text-7xl">
          Events<span className="display-italic">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          {eventDiscoveryDescription(events.length, discovery)}
        </p>
      </header>

      <div className="mb-6">
        <EventsFilterPanel
          discovery={discovery}
          hasActive={hasActiveFilters(discovery)}
        />
      </div>

      <div className="-mx-6 mb-10 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {EVENT_QUICK_FILTERS.map((filter) => {
          const active = discovery.when === filter.key;
          return (
            <Link
              key={filter.key}
              href={filter.href}
              aria-current={active ? "page" : undefined}
              className={
                "shrink-0 rounded-full border px-4 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.16em] transition-colors " +
                (active
                  ? "border-signal bg-signal text-ink"
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
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing matches yet"
          description={
            hasActiveFilters(discovery)
              ? "Clear some filters or widen your search."
              : "New drops will be published soon."
          }
        />
      )}
    </div>
  );
}
