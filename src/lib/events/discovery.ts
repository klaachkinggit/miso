import type { Database, EventRow } from "@/types/db";

export const EVENT_QUICK_FILTERS = [
  { label: "All", key: "all", href: "/events" },
  { label: "Tonight", key: "tonight", href: "/events?when=tonight" },
  { label: "This week", key: "week", href: "/events?when=week" },
  { label: "Weekend", key: "weekend", href: "/events?when=weekend" },
  { label: "Next month", key: "next-month", href: "/events?when=next-month" },
] as const;

export type EventQuickFilterKey = (typeof EVENT_QUICK_FILTERS)[number]["key"];

export type EventGenre = Database["public"]["Enums"]["event_genre"];
export type EventVibe = Database["public"]["Enums"]["event_vibe"];

export const EVENT_GENRES: Array<{ value: EventGenre; label: string }> = [
  { value: "techno", label: "Techno" },
  { value: "afro_house", label: "Afro house" },
  { value: "rap", label: "Rap" },
  { value: "commercial", label: "Commercial" },
  { value: "live", label: "Live" },
];

export const EVENT_VIBES: Array<{ value: EventVibe; label: string }> = [
  { value: "club", label: "Club" },
  { value: "festival", label: "Festival" },
  { value: "rooftop", label: "Rooftop" },
  { value: "student_party", label: "Student party" },
  { value: "private_event", label: "Private event" },
];

export const EVENT_PRICE_BUCKETS = [
  { value: "free", label: "Free", min: 0, max: 0 },
  { value: "under-50", label: "Under €50", min: 0, max: 49.99 },
  { value: "50-150", label: "€50 – €150", min: 50, max: 150 },
  { value: "vip", label: "VIP €150+", min: 150, max: Number.POSITIVE_INFINITY },
] as const;

export type EventPriceBucket = (typeof EVENT_PRICE_BUCKETS)[number]["value"];

export const EVENT_SORTS = [
  { value: "date", label: "Soonest" },
  { value: "popular", label: "Most popular" },
] as const;

export type EventSort = (typeof EVENT_SORTS)[number]["value"];

export interface EventDiscoveryParams {
  when: EventQuickFilterKey;
  q: string;
  city: string;
  genre: EventGenre | "";
  vibe: EventVibe | "";
  price: EventPriceBucket | "";
  festival: boolean;
  sort: EventSort;
}

export type RawEventDiscoveryParams = {
  when?: string;
  q?: string;
  city?: string;
  genre?: string;
  vibe?: string;
  price?: string;
  festival?: string;
  sort?: string;
};

export function normalizeEventDiscoveryParams(
  params: RawEventDiscoveryParams | undefined,
): EventDiscoveryParams {
  const when = EVENT_QUICK_FILTERS.some((filter) => filter.key === params?.when)
    ? (params!.when as EventQuickFilterKey)
    : "all";

  const genre = EVENT_GENRES.some((g) => g.value === params?.genre)
    ? (params!.genre as EventGenre)
    : "";

  const vibe = EVENT_VIBES.some((v) => v.value === params?.vibe)
    ? (params!.vibe as EventVibe)
    : "";

  const price = EVENT_PRICE_BUCKETS.some((p) => p.value === params?.price)
    ? (params!.price as EventPriceBucket)
    : "";

  const sort = EVENT_SORTS.some((s) => s.value === params?.sort)
    ? (params!.sort as EventSort)
    : "date";

  return {
    when,
    q: normalizeSearchToken(params?.q),
    city: normalizeSearchToken(params?.city),
    genre,
    vibe,
    price,
    festival: params?.festival === "1" || params?.festival === "true",
    sort,
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
    if (params.genre && event.genre !== params.genre) return false;
    if (params.vibe && event.vibe !== params.vibe) return false;
    if (params.festival && !event.is_festival) return false;
    if (!q) return true;

    return [
      event.name,
      event.description ?? "",
      event.venue_name,
      event.city,
      ...(event.artists ?? []),
    ].some((value) => value.toLowerCase().includes(q));
  });
}

export function priceBucketRange(
  bucket: EventPriceBucket | "",
): { min: number; max: number } | null {
  if (!bucket) return null;
  const found = EVENT_PRICE_BUCKETS.find((p) => p.value === bucket);
  return found ? { min: found.min, max: found.max } : null;
}

export function eventDiscoveryDescription(
  total: number,
  params: EventDiscoveryParams,
): string {
  const filters = [
    params.q ? `matching "${params.q}"` : null,
    params.city ? `in ${params.city}` : null,
    params.genre ? EVENT_GENRES.find((g) => g.value === params.genre)?.label : null,
    params.vibe ? EVENT_VIBES.find((v) => v.value === params.vibe)?.label : null,
    params.price ? EVENT_PRICE_BUCKETS.find((p) => p.value === params.price)?.label : null,
    params.festival ? "festivals" : null,
  ].filter(Boolean);
  const suffix = filters.length ? ` · ${filters.join(" · ")}` : "";
  return `${total} available · NFT tickets · verified access${suffix}`;
}

export function hasActiveFilters(params: EventDiscoveryParams): boolean {
  return Boolean(
    params.q ||
      params.city ||
      params.genre ||
      params.vibe ||
      params.price ||
      params.festival ||
      params.when !== "all" ||
      params.sort !== "date",
  );
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
