import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

const QUICK_FILTERS = [
  { label: "All", key: "all", href: "/events" },
  { label: "Tonight", key: "tonight", href: "/events?when=tonight" },
  { label: "This week", key: "week", href: "/events?when=week" },
  { label: "Weekend", key: "weekend", href: "/events?when=weekend" },
  { label: "Next month", key: "next-month", href: "/events?when=next-month" },
] as const;

type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function rangeForFilter(filter: QuickFilterKey) {
  const now = new Date();
  if (filter === "tonight") {
    if (now.getHours() < 6) {
      const start = addDays(startOfDay(now), -1);
      start.setHours(18, 0, 0, 0);
      const end = startOfDay(now);
      end.setHours(6, 0, 0, 0);
      return { start, end };
    }
    const start = startOfDay(now);
    start.setHours(18, 0, 0, 0);
    const end = addDays(startOfDay(now), 1);
    end.setHours(6, 0, 0, 0);
    return { start, end };
  }
  if (filter === "week") {
    return { start: now, end: addDays(now, 7) };
  }
  if (filter === "weekend") {
    const day = now.getDay();
    if (day === 0) {
      return { start: now, end: addDays(startOfDay(now), 1) };
    }
    if (day === 6) {
      return { start: now, end: addDays(startOfDay(now), 2) };
    }
    const daysUntilSaturday = (6 - day + 7) % 7;
    const start = startOfDay(addDays(now, daysUntilSaturday));
    return { start, end: addDays(start, 2) };
  }
  if (filter === "next-month") {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end: addMonths(start, 1) };
  }
  return null;
}

function normalizeFilter(value: string | undefined): QuickFilterKey {
  return QUICK_FILTERS.some((filter) => filter.key === value) ? (value as QuickFilterKey) : "all";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ when?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = normalizeFilter(params?.when);
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");

  const sb = createServiceClient();
  let query = sb
    .from("events")
    .select("*")
    .eq("status", "published");
  const range = rangeForFilter(activeFilter);
  if (range) {
    query = query.gte("date", range.start.toISOString()).lt("date", range.end.toISOString());
  }
  const { data: events } = await query.order("date", { ascending: true }).returns<EventRow[]>();

  return (
    <div className="container py-8 pb-20 md:py-12 md:pb-12">
      <PageHeader
        title="Events"
        description={`${events?.length ?? 0} available · NFT tickets · verified access`}
        variant="display"
        className="mb-6"
      />

      <div className="-mx-6 mb-8 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {QUICK_FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={filter.href}
            aria-current={activeFilter === filter.key ? "page" : undefined}
            className={
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
              (activeFilter === filter.key
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")
            }
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {events?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events yet"
          description="New ticket drops will be published soon."
        />
      )}
    </div>
  );
}
