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
  filterDiscoveredEvents,
  hasActiveFilters,
  normalizeEventDiscoveryParams,
  priceBucketRange,
  rangeForEventFilter,
} from "@/lib/events/discovery";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory } from "@/types/db";

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

  const sb = createServiceClient();
  let query = sb
    .from("events")
    .select("*")
    .eq("status", "published");

  const range = rangeForEventFilter(discovery.when);
  if (range) {
    query = query.gte("date", range.start.toISOString()).lt("date", range.end.toISOString());
  }
  if (discovery.genre) query = query.eq("genre", discovery.genre);
  if (discovery.vibe) query = query.eq("vibe", discovery.vibe);
  if (discovery.festival) query = query.eq("is_festival", true);
  if (discovery.q) {
    // Postgres full-text on the generated search_tsv column.
    query = query.textSearch("search_tsv", discovery.q, {
      type: "websearch",
      config: "simple",
    });
  }

  const { data } = await query.order("date", { ascending: true }).returns<EventRow[]>();

  let events = filterDiscoveredEvents(data ?? [], discovery);

  const priceRange = priceBucketRange(discovery.price);
  if (priceRange && events.length) {
    const ids = events.map((event) => event.id);
    const { data: categories } = await sb
      .from("ticket_categories")
      .select("event_id, price")
      .in("event_id", ids)
      .returns<Pick<TicketCategory, "event_id" | "price">[]>();
    const eligibleIds = new Set<string>();
    for (const category of categories ?? []) {
      const value = typeof category.price === "string" ? parseFloat(category.price) : category.price;
      if (value >= priceRange.min && value <= priceRange.max) {
        eligibleIds.add(category.event_id);
      }
    }
    events = events.filter((event) => eligibleIds.has(event.id));
  }

  if (discovery.sort === "popular" && events.length) {
    const ids = events.map((event) => event.id);
    const { data: popularity } = await sb
      .from("event_popularity")
      .select("event_id, tickets_sold")
      .in("event_id", ids);
    const popByEvent = new Map<string, number>(
      (popularity ?? []).map((row) => [row.event_id as string, Number(row.tickets_sold ?? 0)]),
    );
    events = [...events].sort((a, b) => (popByEvent.get(b.id) ?? 0) - (popByEvent.get(a.id) ?? 0));
  }

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
