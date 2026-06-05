import "server-only";

import {
  filterDiscoveredEvents,
  priceBucketRange,
  rangeForEventFilter,
  type EventDiscoveryParams,
} from "@/lib/events/discovery";
import { organizationEventPath } from "@/lib/organizations/public";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory } from "@/types/db";

export type PublicEventCategory = TicketCategory & { remaining: number };

async function activeOrganizationIdsForEvents(events: EventRow[]): Promise<Set<string>> {
  const organizationIds = [
    ...new Set(events.map((event) => event.organization_id).filter((id): id is string => Boolean(id))),
  ];
  if (!organizationIds.length) return new Set();

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organizations")
    .select("id")
    .in("id", organizationIds)
    .eq("status", "active")
    .returns<Array<{ id: string }>>();
  if (error) throw new Error(`Organization status lookup failed: ${error.message}`);
  return new Set((data ?? []).map((organization) => organization.id));
}

async function filterActiveOrganizationEvents(events: EventRow[]): Promise<EventRow[]> {
  const activeIds = await activeOrganizationIdsForEvents(events);
  return events.filter((event) => !event.organization_id || activeIds.has(event.organization_id));
}

export async function listPublishedEvents(params: {
  discovery: EventDiscoveryParams;
  organizationId?: string;
  limit?: number;
}): Promise<EventRow[]> {
  const sb = createServiceClient();
  let query = sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .limit(params.limit ?? 100);

  if (params.organizationId) query = query.eq("organization_id", params.organizationId);

  const range = rangeForEventFilter(params.discovery.when);
  if (range) {
    query = query.gte("date", range.start.toISOString()).lt("date", range.end.toISOString());
  }
  if (params.discovery.genre) query = query.eq("genre", params.discovery.genre);
  if (params.discovery.vibe) query = query.eq("vibe", params.discovery.vibe);
  if (params.discovery.festival) query = query.eq("is_festival", true);
  if (params.discovery.q) {
    query = query.textSearch("search_tsv", params.discovery.q, {
      type: "websearch",
      config: "simple",
    });
  }

  const { data, error } = await query.order("date", { ascending: true }).returns<EventRow[]>();
  if (error) throw new Error(`Event discovery failed: ${error.message}`);

  let events = params.organizationId
    ? (data ?? [])
    : await filterActiveOrganizationEvents(data ?? []);
  events = filterDiscoveredEvents(events, params.discovery);

  const priceRange = priceBucketRange(params.discovery.price);
  if (priceRange && events.length) {
    const ids = events.map((event) => event.id);
    const { data: categories, error: categoryError } = await sb
      .from("ticket_categories")
      .select("event_id, price")
      .in("event_id", ids)
      .returns<Pick<TicketCategory, "event_id" | "price">[]>();
    if (categoryError) throw new Error(`Event price discovery failed: ${categoryError.message}`);

    const eligibleIds = new Set<string>();
    for (const category of categories ?? []) {
      const value = typeof category.price === "string" ? parseFloat(category.price) : category.price;
      if (value >= priceRange.min && value <= priceRange.max) {
        eligibleIds.add(category.event_id);
      }
    }
    events = events.filter((event) => eligibleIds.has(event.id));
  }

  if (params.discovery.sort === "popular" && events.length) {
    const ids = events.map((event) => event.id);
    const { data: popularity, error: popularityError } = await sb
      .from("event_popularity")
      .select("event_id, tickets_sold")
      .in("event_id", ids);
    if (popularityError) throw new Error(`Event popularity discovery failed: ${popularityError.message}`);

    const popByEvent = new Map<string, number>(
      (popularity ?? []).map((row) => [row.event_id as string, Number(row.tickets_sold ?? 0)]),
    );
    events = [...events].sort((a, b) => (popByEvent.get(b.id) ?? 0) - (popByEvent.get(a.id) ?? 0));
  }

  return events;
}

export async function getPublishedEventById(id: string): Promise<EventRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle<EventRow>();
  if (error) throw new Error(`Event lookup failed: ${error.message}`);
  if (!data) return null;
  if (!data.organization_id) return data;
  const [active] = await filterActiveOrganizationEvents([data]);
  return active ?? null;
}

export async function getPublishedEventByOrganizationSlug(params: {
  organizationId: string;
  eventSlug: string;
}): Promise<EventRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("slug", params.eventSlug)
    .eq("status", "published")
    .maybeSingle<EventRow>();
  if (error) throw new Error(`Storefront event lookup failed: ${error.message}`);
  return data ?? null;
}

export async function listPublicEventCategories(eventId: string): Promise<PublicEventCategory[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("event_id", eventId)
    .order("price", { ascending: true })
    .returns<TicketCategory[]>();
  if (error) throw new Error(`Event categories lookup failed: ${error.message}`);

  return (data ?? []).map((category) => ({
    ...category,
    remaining: Math.max(0, category.supply - category.sold_count),
  }));
}

export async function primaryCheckoutCancelPath(categoryId: string): Promise<string> {
  const sb = createServiceClient();
  const { data: category, error: categoryError } = await sb
    .from("ticket_categories")
    .select("event_id")
    .eq("id", categoryId)
    .maybeSingle<Pick<TicketCategory, "event_id">>();
  if (categoryError) throw new Error(`Checkout category lookup failed: ${categoryError.message}`);
  if (!category) return "/checkout/cancel";

  const { data: event, error: eventError } = await sb
    .from("events")
    .select("id, organization_id, slug")
    .eq("id", category.event_id)
    .maybeSingle<Pick<EventRow, "id" | "organization_id" | "slug">>();
  if (eventError) throw new Error(`Checkout event lookup failed: ${eventError.message}`);
  if (!event) return "/checkout/cancel";

  if (event.organization_id && event.slug) {
    const { data: organization, error: organizationError } = await sb
      .from("organizations")
      .select("slug")
      .eq("id", event.organization_id)
      .eq("status", "active")
      .maybeSingle<{ slug: string }>();
    if (organizationError) throw new Error(`Checkout organization lookup failed: ${organizationError.message}`);
    if (organization) return organizationEventPath(organization.slug, event.slug);
  }

  return `/events/${event.id}`;
}
