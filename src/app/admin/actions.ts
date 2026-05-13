"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { creditAdminTopup } from "@/lib/balances/ledger";
import {
  cancelEventSetup,
  cancelUnsoldInventory,
  createDraftEvent,
  createTicketCategory,
  publishEventSetup,
  removeEmptyCategory,
  unpublishEventSetup,
  updateEventDetails,
} from "@/lib/events/setup";
import { refundTicket } from "@/lib/refunds/refund";
import {
  AdminTopupSchema,
  CreateCategorySchema,
  CreateEventSchema,
  InviteControllerSchema,
  RefundSchema,
} from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

  let event: { id: string };
  try {
    event = await createDraftEvent({
      input: parsed.data,
      adminUserId: admin.id,
    });
  } catch (error) {
    fail("/admin/events/new", errorMessage(error, "Event could not be created."));
  }
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

  try {
    await updateEventDetails({
      eventId,
      input: parsed.data,
      adminUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be updated."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
  revalidatePath("/events");
  redirect("/admin");
}

export async function cancelEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");

  try {
    await cancelEventSetup({ eventId, adminUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be canceled."));
  }
  revalidatePath("/admin");
  revalidatePath("/events");
  redirect("/admin");
}

export async function removeCategory(formData: FormData) {
  const admin = await requireAdmin();
  const categoryId = String(formData.get("category_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  if (!categoryId || !eventId) fail(`/admin/events/${eventId}`, "Missing category or event id.");

  try {
    await removeEmptyCategory({ eventId, categoryId, adminUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Category could not be removed."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function cancelUnsoldTickets(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");

  try {
    await cancelUnsoldInventory({
      eventId,
      categoryId: categoryId || null,
      adminUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Tickets could not be canceled."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function publishEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  try {
    await publishEventSetup({ eventId, adminUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be published."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
}

export async function unpublishEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  try {
    await unpublishEventSetup({ eventId, adminUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be unpublished."));
  }
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

  try {
    await createTicketCategory({
      input: parsed.data,
      adminUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${parsed.data.event_id}`, errorMessage(error, "Category could not be created."));
  }
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

export async function adminTopupAccountBalance(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = AdminTopupSchema.safeParse({
    profile_id: formData.get("profile_id"),
    currency: formData.get("currency"),
    amount: formData.get("amount"),
    topup_request_id: formData.get("topup_request_id"),
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid top-up request.");

  try {
    await creditAdminTopup({
      profileId: parsed.data.profile_id,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      referenceId: parsed.data.topup_request_id,
    });

    await audit({
      actorUserId: admin.id,
      action: "balance.admin_topup",
      entityType: "profile",
      entityId: parsed.data.profile_id,
      metadata: {
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        topup_request_id: parsed.data.topup_request_id,
      },
    });
  } catch (error) {
    fail("/admin", errorMessage(error, "Account Balance could not be topped up."));
  }

  revalidatePath("/admin");
  revalidatePath("/balance");
  redirect("/admin?success=Account%20Balance%20topped%20up.");
}
