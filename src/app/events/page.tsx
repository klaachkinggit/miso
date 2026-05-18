import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { getCurrentProfile } from "@/lib/auth";
import {
  EVENT_QUICK_FILTERS,
  eventDiscoveryDescription,
  filterDiscoveredEvents,
  normalizeEventDiscoveryParams,
  rangeForEventFilter,
} from "@/lib/events/discovery";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ when?: string; q?: string; city?: string }>;
}) {
  const discovery = normalizeEventDiscoveryParams(await searchParams);
  const profile = await getCurrentProfile();
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
  const { data } = await query.order("date", { ascending: true }).returns<EventRow[]>();
  const events = filterDiscoveredEvents(data ?? [], discovery);

  return (
    <div className="container py-8 pb-20 md:py-12 md:pb-12">
      <PageHeader
        title="Events"
        description={eventDiscoveryDescription(events.length, discovery)}
        variant="display"
        className="mb-6"
      />

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
          title="No events yet"
          description={
            discovery.q || discovery.city
              ? "Try a different search or city."
              : "New ticket drops will be published soon."
          }
        />
      )}
    </div>
  );
}
