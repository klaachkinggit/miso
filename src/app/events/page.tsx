import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { EventsFilterPanel } from "@/components/site/events-filter-panel";
import { getCurrentProfile } from "@/lib/auth";
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
  const [params, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const discovery = normalizeEventDiscoveryParams(params);
  if (profile?.role === "controller") redirect("/controller");

  const events = await listPublishedEvents({ discovery });

  return (
    <div className="container py-8 pb-20 md:py-12 md:pb-12">
      <PageHeader
        title="Events"
        description={eventDiscoveryDescription(events.length, discovery)}
        variant="display"
        className="mb-6"
      />

      <div className="mb-6">
        <EventsFilterPanel discovery={discovery} hasActive={hasActiveFilters(discovery)} />
      </div>

      <div className="-mx-6 mb-8 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {EVENT_QUICK_FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={filter.href}
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
        ))}
      </div>

      {events.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
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
