// Deep loader for the Organization Analytics dashboard.
//
// Two surfaces consume this module: `src/app/admin/analytics/page.tsx`
// (server-rendered dashboard) and `src/app/api/analytics/export/route.ts`
// (CSV export). Both pass identical filter+range params and render the
// same `OrganizationAnalytics` shape, so any metric change lands here once.
//
// `loadOrganizationAnalytics` is the thin DB shell; the heavy lifting
// (aggregation, bucketing, share math) lives in `aggregateOrganizationAnalytics`
// so the test suite never touches Supabase.

import { createServiceClient } from "@/lib/supabase/service";
import type { Currency } from "@/types/db";

// --- Types --------------------------------------------------------------

export type AnalyticsRangePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "ytd"
  | "all"
  | "custom";

export interface AnalyticsRange {
  preset: AnalyticsRangePreset;
  from: Date;
  to: Date;
}

export interface AnalyticsFilters {
  eventIds?: string[];
  salesChannels?: string[];
  categoryIds?: string[];
}

export interface AnalyticsEventRow {
  id: string;
  name: string;
  date: string;
  city: string;
  venue_name: string;
  status: string;
  capacity: number;
}

export interface AnalyticsCategoryRow {
  event_id: string;
  supply: number;
  sold_count: number;
  currency: Currency;
  id?: string;
}

export interface AnalyticsPurchaseRow {
  event_id: string;
  amount: number;
  currency: Currency;
  status: string;
  sales_channel: string;
  created_at: string;
}

export interface AnalyticsTicketRow {
  event_id: string;
  status: string;
}

export interface AnalyticsTotals {
  gross_revenue: number;
  tickets_sold: number;
  sellout_rate: number;
  refund_rate: number;
  currency: Currency;
}

export interface AnalyticsEventStat {
  event_id: string;
  name: string;
  date: string;
  city: string;
  venue_name: string;
  status: string;
  capacity: number;
  tickets_sold: number;
  tickets_redeemed: number;
  revenue_paid: number;
  currency: Currency;
  attendance_rate: number;
  sellout_rate: number;
}

export interface AnalyticsTimeBucket {
  bucket: string;
  revenue: number;
  tickets: number;
}

export interface AnalyticsChannelStat {
  channel: string;
  revenue: number;
  tickets: number;
  share: number;
}

export interface OrganizationAnalytics {
  range: AnalyticsRange;
  prior: AnalyticsRange | null;
  totals: AnalyticsTotals;
  priorTotals: AnalyticsTotals | null;
  timeseries: AnalyticsTimeBucket[];
  salesChannelBreakdown: AnalyticsChannelStat[];
  events: AnalyticsEventStat[];
}

// --- Range helpers ------------------------------------------------------

const DAY_MS = 86_400_000;

export function rangePresetWindow(
  preset: AnalyticsRangePreset,
  now: Date = new Date(),
): AnalyticsRange {
  const to = new Date(now);
  switch (preset) {
    case "today": {
      const from = new Date(to);
      from.setUTCHours(0, 0, 0, 0);
      return { preset, from, to };
    }
    case "7d":
      return { preset, from: new Date(to.getTime() - 7 * DAY_MS), to };
    case "30d":
      return { preset, from: new Date(to.getTime() - 30 * DAY_MS), to };
    case "90d":
      return { preset, from: new Date(to.getTime() - 90 * DAY_MS), to };
    case "ytd":
      return {
        preset,
        from: new Date(Date.UTC(to.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
        to,
      };
    case "all":
      return { preset, from: new Date(0), to };
    case "custom":
      return { preset, from: to, to };
  }
}

export function computePriorRange(range: AnalyticsRange): AnalyticsRange | null {
  if (range.preset === "all") return null;
  const span = range.to.getTime() - range.from.getTime();
  return {
    preset: range.preset,
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };
}

function bucketSizeMs(range: AnalyticsRange): number {
  const span = range.to.getTime() - range.from.getTime();
  if (range.preset === "today") return 60 * 60 * 1000; // 1h
  if (span <= 60 * DAY_MS) return DAY_MS;
  return 7 * DAY_MS;
}

function bucketKey(date: Date, bucketSize: number): string {
  if (bucketSize === DAY_MS || bucketSize === 7 * DAY_MS) {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  return date.toISOString().slice(0, 13) + ":00:00.000Z"; // hour bucket
}

function alignBucketStart(time: number, range: AnalyticsRange, bucketSize: number): number {
  if (bucketSize === DAY_MS) {
    const d = new Date(time);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }
  if (bucketSize === 7 * DAY_MS) {
    const from = range.from.getTime();
    const offset = Math.floor((time - from) / bucketSize);
    return from + offset * bucketSize;
  }
  // hourly
  return Math.floor(time / bucketSize) * bucketSize;
}

// --- Aggregation --------------------------------------------------------

interface AggregateInput {
  events: AnalyticsEventRow[];
  categories: AnalyticsCategoryRow[];
  purchases: AnalyticsPurchaseRow[];
  tickets: AnalyticsTicketRow[];
}

interface AggregateParams {
  range: AnalyticsRange;
  prior: AnalyticsRange | null;
  filters: AnalyticsFilters;
}

function inRange(ts: number, range: AnalyticsRange): boolean {
  return ts >= range.from.getTime() && ts < range.to.getTime();
}

function applyEventFilter<T extends { event_id: string }>(rows: T[], eventIds?: Set<string>): T[] {
  if (!eventIds) return rows;
  return rows.filter((row) => eventIds.has(row.event_id));
}

function emptyTotals(currency: Currency): AnalyticsTotals {
  return {
    gross_revenue: 0,
    tickets_sold: 0,
    sellout_rate: 0,
    refund_rate: 0,
    currency,
  };
}

function aggregateWindow(
  purchases: AnalyticsPurchaseRow[],
  range: AnalyticsRange,
  salesChannels: Set<string> | null,
  currency: Currency,
  scopedCategories: AnalyticsCategoryRow[],
): AnalyticsTotals {
  let gross = 0;
  let paidCount = 0;
  let refundedCount = 0;
  for (const p of purchases) {
    if (!inRange(new Date(p.created_at).getTime(), range)) continue;
    if (salesChannels && !salesChannels.has(p.sales_channel)) continue;
    if (p.status === "paid") {
      gross += Number(p.amount);
      paidCount += 1;
    } else if (p.status === "refunded") {
      refundedCount += 1;
    }
  }
  const supply = scopedCategories.reduce((acc, c) => acc + c.supply, 0);
  const sold = scopedCategories.reduce((acc, c) => acc + c.sold_count, 0);
  const settled = paidCount + refundedCount;
  return {
    gross_revenue: gross,
    tickets_sold: paidCount,
    sellout_rate: supply > 0 ? sold / supply : 0,
    refund_rate: settled > 0 ? refundedCount / settled : 0,
    currency,
  };
}

export function aggregateOrganizationAnalytics(
  input: AggregateInput,
  params: AggregateParams,
): OrganizationAnalytics {
  const eventFilter = params.filters.eventIds?.length
    ? new Set(params.filters.eventIds)
    : undefined;
  const channelFilter = params.filters.salesChannels?.length
    ? new Set(params.filters.salesChannels)
    : null;
  const categoryFilter = params.filters.categoryIds?.length
    ? new Set(params.filters.categoryIds)
    : null;

  const scopedEvents = eventFilter
    ? input.events.filter((e) => eventFilter.has(e.id))
    : input.events;
  const scopedEventIds = new Set(scopedEvents.map((e) => e.id));

  const scopedCategories = input.categories.filter((c) => {
    if (!scopedEventIds.has(c.event_id)) return false;
    if (categoryFilter && c.id && !categoryFilter.has(c.id)) return false;
    return true;
  });
  const scopedPurchases = applyEventFilter(input.purchases, scopedEventIds);
  const scopedTickets = applyEventFilter(input.tickets, scopedEventIds);

  const currency: Currency = scopedCategories[0]?.currency ?? "EUR";

  const totals = aggregateWindow(
    scopedPurchases,
    params.range,
    channelFilter,
    currency,
    scopedCategories,
  );
  const priorTotals = params.prior
    ? aggregateWindow(scopedPurchases, params.prior, channelFilter, currency, scopedCategories)
    : null;

  // Time series — buckets fully cover the range, even when empty.
  const bucketSize = bucketSizeMs(params.range);
  const buckets = new Map<string, AnalyticsTimeBucket>();
  for (
    let t = alignBucketStart(params.range.from.getTime(), params.range, bucketSize);
    t < params.range.to.getTime();
    t += bucketSize
  ) {
    const key = bucketKey(new Date(t), bucketSize);
    buckets.set(key, { bucket: key, revenue: 0, tickets: 0 });
  }
  for (const p of scopedPurchases) {
    if (p.status !== "paid") continue;
    const ts = new Date(p.created_at).getTime();
    if (!inRange(ts, params.range)) continue;
    if (channelFilter && !channelFilter.has(p.sales_channel)) continue;
    const aligned = alignBucketStart(ts, params.range, bucketSize);
    const key = bucketKey(new Date(aligned), bucketSize);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += Number(p.amount);
      bucket.tickets += 1;
    }
  }
  const timeseries = Array.from(buckets.values()).sort((a, b) =>
    a.bucket < b.bucket ? -1 : 1,
  );

  // Sales channel breakdown — paid purchases inside range, post-filter.
  const channelMap = new Map<string, { revenue: number; tickets: number }>();
  for (const p of scopedPurchases) {
    if (p.status !== "paid") continue;
    if (!inRange(new Date(p.created_at).getTime(), params.range)) continue;
    if (channelFilter && !channelFilter.has(p.sales_channel)) continue;
    const entry = channelMap.get(p.sales_channel) ?? { revenue: 0, tickets: 0 };
    entry.revenue += Number(p.amount);
    entry.tickets += 1;
    channelMap.set(p.sales_channel, entry);
  }
  const channelTotal = totals.gross_revenue;
  const salesChannelBreakdown: AnalyticsChannelStat[] = Array.from(channelMap.entries())
    .map(([channel, { revenue, tickets }]) => ({
      channel,
      revenue,
      tickets,
      share: channelTotal > 0 ? revenue / channelTotal : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Per-event table.
  const soldByEvent = new Map<string, number>();
  const supplyByEvent = new Map<string, number>();
  for (const c of scopedCategories) {
    soldByEvent.set(c.event_id, (soldByEvent.get(c.event_id) ?? 0) + c.sold_count);
    supplyByEvent.set(c.event_id, (supplyByEvent.get(c.event_id) ?? 0) + c.supply);
  }
  const revenueByEvent = new Map<string, number>();
  for (const p of scopedPurchases) {
    if (p.status !== "paid") continue;
    if (channelFilter && !channelFilter.has(p.sales_channel)) continue;
    revenueByEvent.set(p.event_id, (revenueByEvent.get(p.event_id) ?? 0) + Number(p.amount));
  }
  const redeemedByEvent = new Map<string, number>();
  for (const t of scopedTickets) {
    if (t.status !== "used") continue;
    redeemedByEvent.set(t.event_id, (redeemedByEvent.get(t.event_id) ?? 0) + 1);
  }
  const events: AnalyticsEventStat[] = scopedEvents.map((event) => {
    const sold = soldByEvent.get(event.id) ?? 0;
    const supply = supplyByEvent.get(event.id) ?? event.capacity;
    const redeemed = redeemedByEvent.get(event.id) ?? 0;
    return {
      event_id: event.id,
      name: event.name,
      date: event.date,
      city: event.city,
      venue_name: event.venue_name,
      status: event.status,
      capacity: event.capacity,
      tickets_sold: sold,
      tickets_redeemed: redeemed,
      revenue_paid: revenueByEvent.get(event.id) ?? 0,
      currency,
      attendance_rate: sold > 0 ? redeemed / sold : 0,
      sellout_rate: supply > 0 ? sold / supply : 0,
    };
  });

  return {
    range: params.range,
    prior: params.prior,
    totals: scopedEvents.length === 0 ? emptyTotals(currency) : totals,
    priorTotals,
    timeseries,
    salesChannelBreakdown,
    events,
  };
}

// --- DB shell -----------------------------------------------------------

export async function loadOrganizationAnalytics(params: {
  organizationId: string;
  range: AnalyticsRange;
  compare: "prior" | "none";
  filters: AnalyticsFilters;
}): Promise<OrganizationAnalytics> {
  const sb = createServiceClient();

  // Events scope.
  let eventsQuery = sb
    .from("events")
    .select("id, name, date, city, venue_name, status, capacity")
    .eq("organization_id", params.organizationId)
    .order("date", { ascending: false });
  if (params.filters.eventIds?.length) {
    eventsQuery = eventsQuery.in("id", params.filters.eventIds);
  }
  const eventsRes = await eventsQuery;
  const events: AnalyticsEventRow[] = (eventsRes.data ?? []) as AnalyticsEventRow[];
  const eventIds = events.map((e) => e.id);

  if (eventIds.length === 0) {
    return aggregateOrganizationAnalytics(
      { events: [], categories: [], purchases: [], tickets: [] },
      {
        range: params.range,
        prior: params.compare === "prior" ? computePriorRange(params.range) : null,
        filters: params.filters,
      },
    );
  }

  // Purchases: span = current range + prior range (when comparing). Pull
  // the union so the aggregator can split client-side without a second
  // round-trip.
  const prior = params.compare === "prior" ? computePriorRange(params.range) : null;
  const earliest = prior ? prior.from : params.range.from;
  let purchasesQuery = sb
    .from("purchases")
    .select("event_id, amount, currency, status, sales_channel, created_at")
    .in("event_id", eventIds)
    .gte("created_at", earliest.toISOString())
    .lt("created_at", params.range.to.toISOString());
  if (params.filters.salesChannels?.length) {
    purchasesQuery = purchasesQuery.in("sales_channel", params.filters.salesChannels);
  }

  const [purchasesRes, categoriesRes, ticketsRes] = await Promise.all([
    purchasesQuery,
    sb
      .from("ticket_categories")
      .select("id, event_id, supply, sold_count, currency")
      .in("event_id", eventIds),
    sb
      .from("tickets")
      .select("event_id, status")
      .in("event_id", eventIds)
      .eq("status", "used"),
  ]);

  return aggregateOrganizationAnalytics(
    {
      events,
      categories: (categoriesRes.data ?? []) as AnalyticsCategoryRow[],
      purchases: (purchasesRes.data ?? []) as AnalyticsPurchaseRow[],
      tickets: (ticketsRes.data ?? []) as AnalyticsTicketRow[],
    },
    {
      range: params.range,
      prior,
      filters: params.filters,
    },
  );
}
