"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { inviteControllerToEvent } from "@/lib/controllers/invitations";
import {
  createDraftEvent,
  createTicketCategory,
  publishEventSetup,
  updateEventDetails,
} from "@/lib/events/setup";
import {
  OrganizerLegalSchema,
  OrganizerPageSchema,
  refreshOrganizerLiveStatus,
} from "@/lib/organizers/profile";
import { assertOwnEvent } from "@/lib/organizers/permissions";
import { getDefaultAdminOrganizationId } from "@/lib/organizations/auth";
import { CreateCategorySchema, CreateEventSchema, InviteControllerSchema } from "@/lib/schemas";
import { createOnboardingLink } from "@/lib/stripe-marketplace/seller-accounts";
import { createServiceClient } from "@/lib/supabase/service";

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function percentToBps(formData: FormData, key: string): number {
  const raw = parseFloat(String(formData.get(key) ?? "0"));
  return isNaN(raw) ? 0 : Math.round(raw * 100);
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function requireOrganizer() {
  return requireRole("organizer");
}

export async function saveLegalCompliance(formData: FormData) {
  const profile = await requireOrganizer();
  const parsed = OrganizerLegalSchema.safeParse({
    siret: formData.get("siret"),
    no_siret: checkbox(formData, "no_siret"),
  });
  if (!parsed.success) fail("/smartboard?tab=banking", parsed.error.issues[0]?.message ?? "Invalid legal identity.");

  const sb = createServiceClient();
  const { error } = await sb
    .from("organizer_profiles")
    .update({
      siret: parsed.data.siret,
      no_siret: parsed.data.no_siret,
    })
    .eq("user_id", profile.id);
  if (error) fail("/smartboard?tab=banking", error.message);
  await refreshOrganizerLiveStatus(profile.id);
  revalidatePath("/smartboard");
  redirect("/smartboard?tab=banking");
}

export async function startStripeConnect() {
  const profile = await requireOrganizer();
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  let url = "";
  try {
    const link = await createOnboardingLink({
      userId: profile.id,
      email: profile.email,
      appUrl: `${proto}://${host}`,
      returnPath: "/smartboard?tab=banking",
    });
    url = link.url;
  } catch (error) {
    fail("/smartboard?tab=banking", errorMessage(error, "Stripe onboarding could not be started."));
  }
  redirect(url);
}

export async function saveOrganizerPage(formData: FormData) {
  const profile = await requireOrganizer();
  const parsed = OrganizerPageSchema.safeParse({
    page_name: formData.get("page_name"),
    page_slug: formData.get("page_slug"),
    page_description: formData.get("page_description") || null,
    widget_accent_color: formData.get("widget_accent_color"),
  });
  if (!parsed.success) fail("/smartboard?tab=page", parsed.error.issues[0]?.message ?? "Invalid page settings.");

  const sb = createServiceClient();
  const { error } = await sb
    .from("organizer_profiles")
    .update(parsed.data)
    .eq("user_id", profile.id);
  if (error) fail("/smartboard?tab=page", error.message);
  revalidatePath("/smartboard");
  redirect("/smartboard?tab=page");
}

export async function createOrganizerEvent(formData: FormData) {
  const profile = await requireOrganizer();
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
    organizer_resale_royalty_bps: percentToBps(formData, "organizer_resale_royalty_pct"),
  });
  if (!parsed.success) fail("/smartboard", parsed.error.issues[0]?.message ?? "Invalid event.");

  const organizationId = await getDefaultAdminOrganizationId(profile.id);
  if (!organizationId) {
    fail("/smartboard", "Set up your organization before creating events.");
  }

  let eventId = "";
  try {
    const event = await createDraftEvent({
      input: parsed.data,
      actorUserId: profile.id,
      organizerUserId: profile.id,
      organizationId,
    });
    eventId = event.id;
  } catch (error) {
    fail("/smartboard", errorMessage(error, "Event could not be created."));
  }
  redirect(`/smartboard/events/${eventId}`);
}

export async function updateOrganizerEvent(formData: FormData) {
  const profile = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/smartboard", "Missing event id.");
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
    organizer_resale_royalty_bps: percentToBps(formData, "organizer_resale_royalty_pct"),
  });
  if (!parsed.success) fail(`/smartboard/events/${eventId}`, parsed.error.issues[0]?.message ?? "Invalid event.");

  try {
    await assertOwnEvent({ eventId, profile });
    await updateEventDetails({ eventId, input: parsed.data, actorUserId: profile.id });
  } catch (error) {
    fail(`/smartboard/events/${eventId}`, errorMessage(error, "Event could not be updated."));
  }
  revalidatePath(`/smartboard/events/${eventId}`);
  redirect(`/smartboard/events/${eventId}`);
}

export async function createOrganizerCategory(formData: FormData) {
  const profile = await requireOrganizer();
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
  if (!parsed.success) fail("/smartboard", parsed.error.issues[0]?.message ?? "Invalid category.");

  try {
    await assertOwnEvent({ eventId: parsed.data.event_id, profile });
    await createTicketCategory({ input: parsed.data, actorUserId: profile.id });
  } catch (error) {
    fail(`/smartboard/events/${parsed.data.event_id}`, errorMessage(error, "Category could not be created."));
  }
  revalidatePath(`/smartboard/events/${parsed.data.event_id}`);
  redirect(`/smartboard/events/${parsed.data.event_id}`);
}

export async function publishOrganizerEvent(formData: FormData) {
  const profile = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/smartboard", "Missing event id.");

  try {
    await assertOwnEvent({ eventId, profile });
    await publishEventSetup({
      eventId,
      actorUserId: profile.id,
      requireOrganizerLive: true,
    });
  } catch (error) {
    fail(`/smartboard/events/${eventId}`, errorMessage(error, "Event could not be published."));
  }
  revalidatePath(`/smartboard/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/smartboard/events/${eventId}`);
}

export async function inviteOrganizerController(formData: FormData) {
  const profile = await requireOrganizer();
  const parsed = InviteControllerSchema.safeParse({
    event_id: formData.get("event_id"),
    email: formData.get("email"),
  });
  if (!parsed.success) fail("/smartboard", parsed.error.issues[0]?.message ?? "Invalid controller invite.");

  try {
    await assertOwnEvent({ eventId: parsed.data.event_id, profile });
    await inviteControllerToEvent({
      eventId: parsed.data.event_id,
      email: parsed.data.email,
      actorUserId: profile.id,
    });
  } catch (error) {
    fail(`/smartboard/events/${parsed.data.event_id}`, errorMessage(error, "Controller invite could not be sent."));
  }
  revalidatePath(`/smartboard/events/${parsed.data.event_id}`);
  redirect(`/smartboard/events/${parsed.data.event_id}?tab=door`);
}
