"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { casablancaInputToIso } from "@/lib/format";
import { refundTicket } from "@/lib/refunds/refund";
import { CreateCategorySchema, CreateEventSchema, InviteControllerSchema, RefundSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Ticket } from "@/types/db";

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createEvent(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = CreateEventSchema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    venue_name: formData.get("venue_name"),
    city: formData.get("city"),
    capacity: formData.get("capacity"),
    image_url: formData.get("image_url") || null,
    description: formData.get("description") || null,
    conditions: formData.get("conditions") || null,
    sales_enabled: checkbox(formData, "sales_enabled"),
    resale_enabled: checkbox(formData, "resale_enabled"),
    public_sales_counter_enabled: checkbox(formData, "public_sales_counter_enabled"),
  });

  if (!parsed.success) fail("/admin/events/new", parsed.error.issues[0]?.message ?? "Invalid event.");

  const sb = createServiceClient();
  const eventPayload = {
    ...parsed.data,
    date: casablancaInputToIso(parsed.data.date),
    status: "draft" as const,
    solana_collection_address: null,
  };

  const { data: event, error } = await sb
    .from("events")
    .insert(eventPayload)
    .select("*")
    .single<EventRow>();
  if (error || !event) fail("/admin/events/new", error?.message ?? "Event could not be created.");

  await audit({
    actorUserId: admin.id,
    action: "event.create",
    entityType: "event",
    entityId: event.id,
    metadata: { name: event.name },
  });

  const collectionAddress = `demo_collection_${event.id}`;
  await sb
    .from("events")
    .update({ solana_collection_address: collectionAddress })
    .eq("id", event.id);
  await audit({
    actorUserId: admin.id,
    action: "event.collection_demo",
    entityType: "event",
    entityId: event.id,
    metadata: { collection: collectionAddress },
  });
  redirect(`/admin/events/${event.id}`);
}

export async function updateEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");

  const parsed = CreateEventSchema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    venue_name: formData.get("venue_name"),
    city: formData.get("city"),
    capacity: formData.get("capacity"),
    image_url: formData.get("image_url") || null,
    description: formData.get("description") || null,
    conditions: formData.get("conditions") || null,
    sales_enabled: checkbox(formData, "sales_enabled"),
    resale_enabled: checkbox(formData, "resale_enabled"),
    public_sales_counter_enabled: checkbox(formData, "public_sales_counter_enabled"),
  });
  if (!parsed.success) fail(`/admin/events/${eventId}`, parsed.error.issues[0]?.message ?? "Invalid event.");

  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ ...parsed.data, date: casablancaInputToIso(parsed.data.date) })
    .eq("id", eventId);
  if (error) fail(`/admin/events/${eventId}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "event.update",
    entityType: "event",
    entityId: eventId,
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
  revalidatePath("/events");
  redirect("/admin");
}

export async function cancelEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");

  const sb = createServiceClient();
  const { data: event } = await sb.from("events").select("*").eq("id", eventId).single<EventRow>();
  if (!event) fail("/admin", "Event not found.");

  const { error: eventError } = await sb
    .from("events")
    .update({ status: "canceled" })
    .eq("id", eventId);
  if (eventError) fail(`/admin/events/${eventId}`, eventError.message);

  // Unsold inventory → canceled (no payment ever happened).
  await sb
    .from("tickets")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), reserved_until: null })
    .eq("event_id", eventId)
    .in("status", ["available", "reserved"]);

  // Sold/listed tickets → refund_pending so admin can process refunds without
  // immediately burning the NFTs the buyers still hold.
  await sb
    .from("tickets")
    .update({ status: "refund_pending" })
    .eq("event_id", eventId)
    .in("status", ["sold", "listed"]);

  await audit({
    actorUserId: admin.id,
    action: "event.cancel",
    entityType: "event",
    entityId: eventId,
  });
  revalidatePath("/admin");
  revalidatePath("/events");
  redirect("/admin");
}

export async function removeCategory(formData: FormData) {
  const admin = await requireAdmin();
  const categoryId = String(formData.get("category_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  if (!categoryId || !eventId) fail(`/admin/events/${eventId}`, "Missing category or event id.");

  const sb = createServiceClient();
  const { data: category } = await sb
    .from("ticket_categories")
    .select("id, sold_count")
    .eq("id", categoryId)
    .single<{ id: string; sold_count: number }>();
  if (!category) fail(`/admin/events/${eventId}`, "Category not found.");
  if (category.sold_count > 0) {
    fail(`/admin/events/${eventId}`, "Category has sold tickets and cannot be removed.");
  }

  const { error: ticketsError } = await sb
    .from("tickets")
    .delete()
    .eq("category_id", categoryId)
    .in("status", ["available", "reserved"]);
  if (ticketsError) fail(`/admin/events/${eventId}`, ticketsError.message);

  const { error: catError } = await sb.from("ticket_categories").delete().eq("id", categoryId);
  if (catError) fail(`/admin/events/${eventId}`, catError.message);

  await audit({
    actorUserId: admin.id,
    action: "category.remove",
    entityType: "ticket_category",
    entityId: categoryId,
    metadata: { event_id: eventId },
  });
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function cancelUnsoldTickets(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");

  const sb = createServiceClient();
  let query = sb
    .from("tickets")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), reserved_until: null })
    .eq("event_id", eventId)
    .in("status", ["available", "reserved"]);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { error } = await query;
  if (error) fail(`/admin/events/${eventId}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "tickets.cancel_unsold",
    entityType: "event",
    entityId: eventId,
    metadata: { category_id: categoryId || null },
  });
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function publishEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  const sb = createServiceClient();
  const { data: event } = await sb.from("events").select("*").eq("id", eventId).single<EventRow>();
  if (!event?.solana_collection_address) fail(`/admin/events/${eventId}`, "Mint the Solana collection before publishing.");

  const { error } = await sb.from("events").update({ status: "published" }).eq("id", eventId);
  if (error) fail(`/admin/events/${eventId}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "event.publish",
    entityType: "event",
    entityId: eventId,
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
}

export async function unpublishEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  const sb = createServiceClient();
  const { error } = await sb.from("events").update({ status: "draft" }).eq("id", eventId);
  if (error) fail(`/admin/events/${eventId}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "event.unpublish",
    entityType: "event",
    entityId: eventId,
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
}

export async function createCategory(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = CreateCategorySchema.safeParse({
    event_id: formData.get("event_id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    currency: formData.get("currency"),
    supply: formData.get("supply"),
    max_resale_price: formData.get("max_resale_price") || null,
    resale_enabled: checkbox(formData, "resale_enabled"),
    benefits: formData.get("benefits") || null,
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid category.");

  const sb = createServiceClient();
  const { data: category, error: categoryError } = await sb
    .from("ticket_categories")
    .insert(parsed.data)
    .select("*")
    .single<{ id: string; event_id: string; supply: number }>();
  if (categoryError || !category) fail(`/admin/events/${parsed.data.event_id}`, categoryError?.message ?? "Category could not be created.");

  const { data: lastTicket } = await sb
    .from("tickets")
    .select("serial_number")
    .eq("event_id", parsed.data.event_id)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Ticket, "serial_number">>();

  const offset = lastTicket?.serial_number ?? 0;
  const ticketRows = Array.from({ length: parsed.data.supply }, (_, index) => ({
    event_id: parsed.data.event_id,
    category_id: category.id,
    serial_number: offset + index + 1,
    status: "available" as const,
  }));

  const { error: ticketsError } = await sb.from("tickets").insert(ticketRows);
  if (ticketsError) {
    await sb.from("ticket_categories").delete().eq("id", category.id);
    fail(`/admin/events/${parsed.data.event_id}`, ticketsError.message);
  }

  await audit({
    actorUserId: admin.id,
    action: "category.create",
    entityType: "ticket_category",
    entityId: category.id,
    metadata: { event_id: parsed.data.event_id, supply: parsed.data.supply },
  });
  revalidatePath(`/admin/events/${parsed.data.event_id}`);
}

export async function inviteController(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = InviteControllerSchema.safeParse({
    event_id: formData.get("event_id"),
    email: formData.get("email"),
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid controller invite.");

  const sb = createServiceClient();
  const email = parsed.data.email.toLowerCase();
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle<{ id: string; role: string }>();

  let userId = existingProfile?.id;
  if (!userId) {
    const invite = await sb.auth.admin.inviteUserByEmail(email);
    if (invite.error || !invite.data.user) {
      fail(`/admin/events/${parsed.data.event_id}`, invite.error?.message ?? "Invite could not be sent.");
    }
    userId = invite.data.user.id;
    await sb.from("profiles").upsert({
      id: userId,
      email,
      display_name: email.split("@")[0],
      role: "controller",
    });
  } else if (existingProfile?.role !== "admin") {
    await sb.from("profiles").update({ role: "controller" }).eq("id", userId);
  }

  const { error } = await sb.from("event_controllers").upsert({
    event_id: parsed.data.event_id,
    user_id: userId,
  });
  if (error) fail(`/admin/events/${parsed.data.event_id}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "controller.invite",
    entityType: "event",
    entityId: parsed.data.event_id,
    metadata: { email, user_id: userId },
  });
  revalidatePath(`/admin/events/${parsed.data.event_id}`);
}

export async function refundTicketAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = RefundSchema.safeParse({
    ticket_id: formData.get("ticket_id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid refund request.");

  await refundTicket({
    ticketId: parsed.data.ticket_id,
    adminUserId: admin.id,
    reason: parsed.data.reason,
  });
  revalidatePath("/admin");
}
