import type { EventRow } from "@/types/db";

export const EVENT_QUICK_FILTERS = [
  { label: "All", key: "all", href: "/events" },
  { label: "Tonight", key: "tonight", href: "/events?when=tonight" },
  { label: "This week", key: "week", href: "/events?when=week" },
  { label: "Weekend", key: "weekend", href: "/events?when=weekend" },
  { label: "Next month", key: "next-month", href: "/events?when=next-month" },
] as const;

export type EventQuickFilterKey = (typeof EVENT_QUICK_FILTERS)[number]["key"];

export interface EventDiscoveryParams {
  when: EventQuickFilterKey;
  q: string;
  city: string;
}

export type RawEventDiscoveryParams = {
  when?: string;
  q?: string;
  city?: string;
};

export function normalizeEventDiscoveryParams(
  params: RawEventDiscoveryParams | undefined,
): EventDiscoveryParams {
  const when = EVENT_QUICK_FILTERS.some((filter) => filter.key === params?.when)
    ? (params!.when as EventQuickFilterKey)
    : "all";

  return {
    when,
    q: normalizeSearchToken(params?.q),
    city: normalizeSearchToken(params?.city),
  };
}

export function rangeForEventFilter(
  filter: EventQuickFilterKey,
  now = new Date(),
): { start: Date; end: Date } | null {
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

  if (filter === "week") return { start: now, end: addDays(now, 7) };

  if (filter === "weekend") {
    const day = now.getDay();
    if (day === 0) return { start: now, end: addDays(startOfDay(now), 1) };
    if (day === 6) return { start: now, end: addDays(startOfDay(now), 2) };
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

export function filterDiscoveredEvents(
  events: EventRow[],
  params: EventDiscoveryParams,
): EventRow[] {
  const q = params.q.toLowerCase();
  const city = params.city.toLowerCase();

  return events.filter((event) => {
    if (city && !event.city.toLowerCase().includes(city)) return false;
    if (!q) return true;

    return [
      event.name,
      event.description ?? "",
      event.venue_name,
      event.city,
    ].some((value) => value.toLowerCase().includes(q));
  });
}

export function eventDiscoveryDescription(
  total: number,
  params: EventDiscoveryParams,
): string {
  const filters = [
    params.q ? `matching "${params.q}"` : null,
    params.city ? `in ${params.city}` : null,
  ].filter(Boolean);
  const suffix = filters.length ? ` · ${filters.join(" · ")}` : "";
  return `${total} available · NFT tickets · verified access${suffix}`;
}

function normalizeSearchToken(value: string | undefined): string {
  return value?.trim().slice(0, 80) ?? "";
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
