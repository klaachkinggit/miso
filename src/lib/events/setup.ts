import { audit } from "@/lib/audit";
import { demoCollectionAddress } from "@/lib/demo/artifacts";
import { casablancaInputToIso } from "@/lib/format";
import { cancelUnsoldTickets, markSoldTicketsRefundPending } from "@/lib/tickets/lifecycle";
import { createServiceClient } from "@/lib/supabase/service";
import type { Currency, EventRow, Ticket } from "@/types/db";

export interface EventDetailsInput {
  name: string;
  date: string;
  venue_name: string;
  city: string;
  capacity: number;
  image_url?: string | null;
  description?: string | null;
  conditions?: string | null;
  sales_enabled: boolean;
  resale_enabled: boolean;
  public_sales_counter_enabled: boolean;
}

export interface CategoryInput {
  event_id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: Currency;
  supply: number;
  max_resale_price?: number | null;
  resale_enabled: boolean;
  benefits?: string | null;
}

export async function createDraftEvent(params: {
  input: EventDetailsInput;
  adminUserId: string;
}): Promise<EventRow> {
  const sb = createServiceClient();
  const eventPayload = {
    ...params.input,
    date: casablancaInputToIso(params.input.date),
    status: "draft" as const,
    solana_collection_address: null,
  };

  const { data: event, error } = await sb
    .from("events")
    .insert(eventPayload)
    .select("*")
    .single<EventRow>();
  if (error || !event) throw error ?? new Error("Event could not be created.");

  await audit({
    actorUserId: params.adminUserId,
    action: "event.create",
    entityType: "event",
    entityId: event.id,
    metadata: { name: event.name },
  });

  await assignDemoCollection({
    eventId: event.id,
    adminUserId: params.adminUserId,
    auditAction: "event.collection_demo",
  });

  return {
    ...event,
    solana_collection_address: demoCollectionAddress(event.id),
  };
}

export async function updateEventDetails(params: {
  eventId: string;
  input: EventDetailsInput;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ ...params.input, date: casablancaInputToIso(params.input.date) })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: "event.update",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function cancelEventSetup(params: {
  eventId: string;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single<EventRow>();
  if (!event) throw new Error("Event not found.");

  const { error } = await sb
    .from("events")
    .update({ status: "canceled" })
    .eq("id", params.eventId);
  if (error) throw error;

  await cancelUnsoldTickets({ eventId: params.eventId });
  await markSoldTicketsRefundPending(params.eventId);

  await audit({
    actorUserId: params.adminUserId,
    action: "event.cancel",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function removeEmptyCategory(params: {
  eventId: string;
  categoryId: string;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: category } = await sb
    .from("ticket_categories")
    .select("id, sold_count")
    .eq("id", params.categoryId)
    .single<{ id: string; sold_count: number }>();
  if (!category) throw new Error("Category not found.");
  if (category.sold_count > 0) {
    throw new Error("Category has sold tickets and cannot be removed.");
  }

  const { error: ticketsError } = await sb
    .from("tickets")
    .delete()
    .eq("category_id", params.categoryId)
    .in("status", ["available", "reserved"]);
  if (ticketsError) throw ticketsError;

  const { error: categoryError } = await sb
    .from("ticket_categories")
    .delete()
    .eq("id", params.categoryId);
  if (categoryError) throw categoryError;

  await audit({
    actorUserId: params.adminUserId,
    action: "category.remove",
    entityType: "ticket_category",
    entityId: params.categoryId,
    metadata: { event_id: params.eventId },
  });
}

export async function cancelUnsoldInventory(params: {
  eventId: string;
  categoryId?: string | null;
  adminUserId: string;
}): Promise<void> {
  await cancelUnsoldTickets({
    eventId: params.eventId,
    categoryId: params.categoryId,
  });

  await audit({
    actorUserId: params.adminUserId,
    action: "tickets.cancel_unsold",
    entityType: "event",
    entityId: params.eventId,
    metadata: { category_id: params.categoryId || null },
  });
}

export async function publishEventSetup(params: {
  eventId: string;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single<EventRow>();
  if (!event?.solana_collection_address) {
    throw new Error("Assign the demo Collection before publishing.");
  }

  const { error } = await sb
    .from("events")
    .update({ status: "published" })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: "event.publish",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function unpublishEventSetup(params: {
  eventId: string;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ status: "draft" })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: "event.unpublish",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function createTicketCategory(params: {
  input: CategoryInput;
  adminUserId: string;
}): Promise<{ id: string; event_id: string; supply: number }> {
  const sb = createServiceClient();
  const insertPayload = {
    ...params.input,
    max_resale_price: params.input.max_resale_price ?? null,
  };
  const { data: category, error: categoryError } = await sb
    .from("ticket_categories")
    .insert(insertPayload)
    .select("*")
    .single<{ id: string; event_id: string; supply: number }>();
  if (categoryError || !category) {
    throw categoryError ?? new Error("Category could not be created.");
  }

  const { data: lastTicket } = await sb
    .from("tickets")
    .select("serial_number")
    .eq("event_id", params.input.event_id)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Ticket, "serial_number">>();

  const offset = lastTicket?.serial_number ?? 0;
  const ticketRows = Array.from({ length: params.input.supply }, (_, index) => ({
    event_id: params.input.event_id,
    category_id: category.id,
    serial_number: offset + index + 1,
    status: "available" as const,
  }));

  const { error: ticketsError } = await sb.from("tickets").insert(ticketRows);
  if (ticketsError) {
    await sb.from("ticket_categories").delete().eq("id", category.id);
    throw ticketsError;
  }

  await audit({
    actorUserId: params.adminUserId,
    action: "category.create",
    entityType: "ticket_category",
    entityId: category.id,
    metadata: { event_id: params.input.event_id, supply: params.input.supply },
  });

  return category;
}

export async function assignDemoCollection(params: {
  eventId: string;
  adminUserId: string;
  auditAction?: string;
}): Promise<string> {
  const sb = createServiceClient();
  const collectionAddress = demoCollectionAddress(params.eventId);
  const { error } = await sb
    .from("events")
    .update({ solana_collection_address: collectionAddress })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: params.auditAction ?? "event.collection_demo_retry",
    entityType: "event",
    entityId: params.eventId,
    metadata: { collection: collectionAddress },
  });

  return collectionAddress;
}
