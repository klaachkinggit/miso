import "server-only";

import {
  organizationMarketplaceListingPath,
} from "@/lib/organizations/public";
import { resalePlatformFee, resaleRoyaltyAmount } from "@/lib/resale/pricing";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, ResaleListing, Ticket, TicketCategory } from "@/types/db";

export type SellableResaleListing = {
  listing: ResaleListing;
  ticket: Ticket;
  event: EventRow;
  category: TicketCategory;
  platformFee: number;
  royaltyAmount: number;
  buyerTotal: number;
};

function toSellable(params: {
  listing: ResaleListing;
  ticket: Ticket | undefined;
  event: EventRow | undefined;
  category: TicketCategory | undefined;
  organizationId?: string;
  activeOrganizationsById?: Map<string, { resale_royalty_enabled: boolean; resale_royalty_bps: number }>;
}): SellableResaleListing | null {
  const { listing, ticket, event, category, organizationId, activeOrganizationsById } = params;
  if (!ticket || ticket.status !== "listed") return null;
  if (!event || event.status !== "published") return null;
  if (organizationId && event.organization_id !== organizationId) return null;
  const listingOrganizationId = listing.organization_id ?? event.organization_id;
  const organization = listingOrganizationId ? activeOrganizationsById?.get(listingOrganizationId) : undefined;
  if (listingOrganizationId && activeOrganizationsById && !organization) return null;
  if (new Date(event.date).getTime() < Date.now()) return null;
  if (!category?.resale_enabled) return null;

  const platformFee = resalePlatformFee(Number(listing.price));
  const royaltyAmount = resaleRoyaltyAmount({
    sellerAmount: Number(listing.price),
    enabled: organization?.resale_royalty_enabled ?? false,
    bps: organization?.resale_royalty_bps ?? 0,
  });
  return {
    listing,
    ticket,
    event,
    category,
    platformFee,
    royaltyAmount,
    buyerTotal: Number(listing.price) + platformFee + royaltyAmount,
  };
}

async function activeOrganizationsById(
  ids: string[],
): Promise<Map<string, { resale_royalty_enabled: boolean; resale_royalty_bps: number }>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organizations")
    .select("id, resale_royalty_enabled, resale_royalty_bps")
    .in("id", uniqueIds)
    .eq("status", "active")
    .returns<Array<{ id: string; resale_royalty_enabled: boolean; resale_royalty_bps: number }>>();
  if (error) throw new Error(`Marketplace organization status lookup failed: ${error.message}`);
  return new Map((data ?? []).map((organization) => [organization.id, organization]));
}

export async function listSellableResaleListings(params: {
  organizationId?: string;
  limit?: number;
} = {}): Promise<SellableResaleListing[]> {
  const sb = createServiceClient();
  let query = sb
    .from("resale_listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);
  if (params.organizationId) query = query.eq("organization_id", params.organizationId);

  const { data: listings, error: listingError } = await query.returns<ResaleListing[]>();
  if (listingError) throw new Error(`Marketplace listings lookup failed: ${listingError.message}`);

  const ticketIds = [...new Set((listings ?? []).map((listing) => listing.ticket_id))];
  const { data: tickets, error: ticketError } = ticketIds.length
    ? await sb.from("tickets").select("*").in("id", ticketIds).returns<Ticket[]>()
    : { data: [] as Ticket[], error: null };
  if (ticketError) throw new Error(`Marketplace tickets lookup failed: ${ticketError.message}`);

  const eventIds = [...new Set((tickets ?? []).map((ticket) => ticket.event_id))];
  const categoryIds = [...new Set((tickets ?? []).map((ticket) => ticket.category_id))];

  const [{ data: events, error: eventError }, { data: categories, error: categoryError }] = await Promise.all([
    eventIds.length
      ? sb.from("events").select("*").in("id", eventIds).returns<EventRow[]>()
      : Promise.resolve({ data: [] as EventRow[], error: null }),
    categoryIds.length
      ? sb.from("ticket_categories").select("*").in("id", categoryIds).returns<TicketCategory[]>()
      : Promise.resolve({ data: [] as TicketCategory[], error: null }),
  ]);
  if (eventError) throw new Error(`Marketplace events lookup failed: ${eventError.message}`);
  if (categoryError) throw new Error(`Marketplace categories lookup failed: ${categoryError.message}`);

  const ticketById = new Map((tickets ?? []).map((ticket) => [ticket.id, ticket]));
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const activeOrganizations = await activeOrganizationsById([
    ...(listings ?? []).map((listing) => listing.organization_id ?? ""),
    ...(events ?? []).map((event) => event.organization_id ?? ""),
  ]);

  return (listings ?? [])
    .map((listing) =>
      toSellable({
        listing,
        ticket: ticketById.get(listing.ticket_id),
        event: eventById.get(ticketById.get(listing.ticket_id)?.event_id ?? ""),
        category: categoryById.get(ticketById.get(listing.ticket_id)?.category_id ?? ""),
        organizationId: params.organizationId,
        activeOrganizationsById: activeOrganizations,
      }),
    )
    .filter((listing): listing is SellableResaleListing => Boolean(listing));
}

export async function getSellableResaleListing(params: {
  listingId: string;
  organizationId?: string;
}): Promise<SellableResaleListing | null> {
  const sb = createServiceClient();
  const { data: listing, error: listingError } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", params.listingId)
    .maybeSingle<ResaleListing>();
  if (listingError) throw new Error(`Marketplace listing lookup failed: ${listingError.message}`);
  if (!listing) return null;
  if (params.organizationId && listing.organization_id !== params.organizationId) return null;

  const { data: ticket, error: ticketError } = await sb
    .from("tickets")
    .select("*")
    .eq("id", listing.ticket_id)
    .maybeSingle<Ticket>();
  if (ticketError) throw new Error(`Marketplace ticket lookup failed: ${ticketError.message}`);
  if (!ticket) return null;

  const [{ data: event, error: eventError }, { data: category, error: categoryError }] = await Promise.all([
    sb.from("events").select("*").eq("id", ticket.event_id).maybeSingle<EventRow>(),
    sb.from("ticket_categories").select("*").eq("id", ticket.category_id).maybeSingle<TicketCategory>(),
  ]);
  if (eventError) throw new Error(`Marketplace event lookup failed: ${eventError.message}`);
  if (categoryError) throw new Error(`Marketplace category lookup failed: ${categoryError.message}`);
  const activeOrganizations = await activeOrganizationsById([
    listing.organization_id ?? "",
    event?.organization_id ?? "",
  ]);

  return (
    toSellable({
      listing,
      ticket,
      event: event ?? undefined,
      category: category ?? undefined,
      organizationId: params.organizationId,
      activeOrganizationsById: activeOrganizations,
    }) ?? null
  );
}

export async function resaleCheckoutCancelPath(listingId: string): Promise<string> {
  const sb = createServiceClient();
  const { data: listing, error: listingError } = await sb
    .from("resale_listings")
    .select("id, organization_id, ticket_id")
    .eq("id", listingId)
    .maybeSingle<Pick<ResaleListing, "id" | "organization_id" | "ticket_id">>();
  if (listingError) throw new Error(`Marketplace listing lookup failed: ${listingError.message}`);
  if (!listing) return "/marketplace";

  const { data: ticket, error: ticketError } = await sb
    .from("tickets")
    .select("event_id")
    .eq("id", listing.ticket_id)
    .maybeSingle<Pick<Ticket, "event_id">>();
  if (ticketError) throw new Error(`Marketplace ticket lookup failed: ${ticketError.message}`);

  const eventId = ticket?.event_id;
  const { data: event, error: eventError } = eventId
    ? await sb
        .from("events")
        .select("organization_id")
        .eq("id", eventId)
        .maybeSingle<Pick<EventRow, "organization_id">>()
    : { data: null, error: null };
  if (eventError) throw new Error(`Marketplace event lookup failed: ${eventError.message}`);

  const organizationId = listing.organization_id ?? event?.organization_id;
  if (organizationId) {
    const { data: organization, error: organizationError } = await sb
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .eq("status", "active")
      .maybeSingle<{ slug: string }>();
    if (organizationError) throw new Error(`Marketplace organization lookup failed: ${organizationError.message}`);
    if (organization) return organizationMarketplaceListingPath(organization.slug, listing.id);
  }

  return `/marketplace/${listing.id}`;
}
