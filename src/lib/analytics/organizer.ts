// Aggregations powering the organizer analytics dashboard.
// All queries run with the service-role client (no RLS) because the
// dashboard is gated before calling this loader.
import { createServiceClient } from "@/lib/supabase/service";
import {
  getAdminOrganizationIds,
  shouldUseLegacyOrganizerEventScope,
} from "@/lib/organizations/auth";
import type { Currency, Profile } from "@/types/db";

export interface OrganizerTotals {
  total_events: number;
  published_events: number;
  draft_events: number;
  tickets_sold: number;
  tickets_redeemed: number;
  total_capacity: number;
  revenue_paid: number;
  currency: Currency;
}

export interface OrganizerEventStat {
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

// `sold_count` on ticket_categories is the authoritative sales counter
// (already used by checkout to decide capacity). Pair it with paid
// purchases for revenue. Redemptions = tickets.status = "used".
export async function loadOrganizerOverview(params: {
  profile: Pick<Profile, "id" | "role">;
  organizationId?: string | null;
}): Promise<{
  totals: OrganizerTotals;
  events: OrganizerEventStat[];
}> {
  const sb = createServiceClient();
  const organizationIds = await getAdminOrganizationIds(params.profile.id);
  const scopedToOrganization = params.organizationId && organizationIds.includes(params.organizationId);
  const scopedToOrganizer = shouldUseLegacyOrganizerEventScope(
    params.profile,
    Boolean(scopedToOrganization || organizationIds.length),
  );

  let eventsQuery = sb
    .from("events")
    .select("id, name, date, city, venue_name, status, capacity")
    .order("date", { ascending: false });

  if (scopedToOrganization) {
    eventsQuery = eventsQuery.eq("organization_id", params.organizationId!);
  } else if (organizationIds.length) {
    eventsQuery = eventsQuery.in("organization_id", organizationIds);
  } else if (scopedToOrganizer) {
    eventsQuery = eventsQuery.eq("organizer_user_id", params.profile.id);
  }

  const [eventsRes, categoriesRes, purchasesRes, redemptionsRes] = await Promise.all([
    eventsQuery,
    sb.from("ticket_categories").select("event_id, supply, sold_count, currency"),
    sb
      .from("purchases")
      .select("event_id, amount, currency, status")
      .eq("status", "paid"),
    sb.from("tickets").select("event_id, status").eq("status", "used"),
  ]);

  const events = eventsRes.data ?? [];
  const eventIds = new Set(events.map((event) => event.id));
  const categories = categoriesRes.data ?? [];
  const purchases = purchasesRes.data ?? [];
  const redemptions = redemptionsRes.data ?? [];

  const soldByEvent = new Map<string, number>();
  const supplyByEvent = new Map<string, number>();
  let totalsCurrency: Currency = "EUR";
  for (const row of categories) {
    if (!eventIds.has(row.event_id)) continue;
    soldByEvent.set(row.event_id, (soldByEvent.get(row.event_id) ?? 0) + row.sold_count);
    supplyByEvent.set(row.event_id, (supplyByEvent.get(row.event_id) ?? 0) + row.supply);
    totalsCurrency = row.currency;
  }

  const revenueByEvent = new Map<string, number>();
  for (const purchase of purchases) {
    if (!eventIds.has(purchase.event_id)) continue;
    revenueByEvent.set(purchase.event_id, (revenueByEvent.get(purchase.event_id) ?? 0) + Number(purchase.amount));
  }

  const redeemedByEvent = new Map<string, number>();
  for (const ticket of redemptions) {
    if (!eventIds.has(ticket.event_id)) continue;
    redeemedByEvent.set(ticket.event_id, (redeemedByEvent.get(ticket.event_id) ?? 0) + 1);
  }

  const perEvent: OrganizerEventStat[] = events.map((event) => {
    const tickets_sold = soldByEvent.get(event.id) ?? 0;
    const supply = supplyByEvent.get(event.id) ?? event.capacity;
    const redeemed = redeemedByEvent.get(event.id) ?? 0;
    const revenue = revenueByEvent.get(event.id) ?? 0;
    return {
      event_id: event.id,
      name: event.name,
      date: event.date,
      city: event.city,
      venue_name: event.venue_name,
      status: event.status,
      capacity: event.capacity,
      tickets_sold,
      tickets_redeemed: redeemed,
      revenue_paid: revenue,
      currency: totalsCurrency,
      sellout_rate: supply > 0 ? tickets_sold / supply : 0,
      attendance_rate: tickets_sold > 0 ? redeemed / tickets_sold : 0,
    };
  });

  const totals: OrganizerTotals = {
    total_events: events.length,
    published_events: events.filter((e) => e.status === "published").length,
    draft_events: events.filter((e) => e.status === "draft").length,
    tickets_sold: Array.from(soldByEvent.values()).reduce((a, b) => a + b, 0),
    tickets_redeemed: Array.from(redeemedByEvent.values()).reduce((a, b) => a + b, 0),
    total_capacity: Array.from(supplyByEvent.values()).reduce((a, b) => a + b, 0),
    revenue_paid: Array.from(revenueByEvent.values()).reduce((a, b) => a + b, 0),
    currency: totalsCurrency,
  };

  return { totals, events: perEvent };
}
