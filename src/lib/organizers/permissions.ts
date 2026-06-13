import type { Profile } from "@/types/db";
import { createServiceClient } from "@/lib/supabase/service";
import { assertPayoutReady } from "@/lib/stripe-marketplace/seller-accounts";
import { getOrganizerCompliance } from "./profile";

const ACTIVE_TICKET_STATUSES = ["available", "reserved", "sold", "listed", "used", "minting", "transferring"];

export async function assertOrganizerLive(userId: string): Promise<void> {
  const compliance = await getOrganizerCompliance(userId);
  if (!compliance.organizer) {
    throw new Error("Organizer onboarding is incomplete.");
  }
  if (!compliance.legalReady) {
    throw new Error("Add legal identity before publishing.");
  }
  if (!compliance.stripeReady) {
    throw new Error("Complete Stripe Connect verification before publishing.");
  }
  if (compliance.organizer.status !== "live") {
    throw new Error("Organizer account is still in Sandbox.");
  }
}

export async function assertOwnEvent(params: {
  eventId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<void> {
  if (params.profile.role === "admin") return;
  const sb = createServiceClient();
  const { data } = await sb
    .from("events")
    .select("id")
    .eq("id", params.eventId)
    .eq("organizer_user_id", params.profile.id)
    .maybeSingle<{ id: string }>();
  if (!data) throw new Error("Event not found or not owned by organizer.");
}

export async function assertEventPublishable(params: {
  eventId: string;
  requireOrganizerLive?: boolean;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id, organizer_user_id")
    .eq("id", params.eventId)
    .single<{ id: string; organizer_user_id: string | null }>();
  if (!event) throw new Error("Event not found.");

  const { data: categories, error: categoriesError } = await sb
    .from("ticket_categories")
    .select("id, price, currency")
    .eq("event_id", params.eventId)
    .returns<Array<{ id: string; price: number; currency: string }>>();
  if (categoriesError) throw categoriesError;
  if (!categories?.length) {
    throw new Error("Create at least one ticket category before publishing.");
  }

  const { data: ticket } = await sb
    .from("tickets")
    .select("id")
    .eq("event_id", params.eventId)
    .in("status", ACTIVE_TICKET_STATUSES)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!ticket) throw new Error("Seed tickets before publishing.");

  const paidCategories = categories.filter((category) => Number(category.price) > 0);
  const paidMad = paidCategories.find((category) => category.currency === "MAD");
  if (paidMad) {
    throw new Error("Paid MAD inventory cannot be published yet. MAD payment is not supported yet; use EUR for paid ticket sales.");
  }

  if (params.requireOrganizerLive || event.organizer_user_id) {
    if (!event.organizer_user_id) {
      throw new Error("Assign an organizer before publishing.");
    }
    await assertOrganizerLive(event.organizer_user_id);
  }

  const paidEur = paidCategories.find((category) => category.currency === "EUR");
  if (paidEur) {
    if (!event.organizer_user_id) {
      throw new Error("Assign an organizer before publishing paid EUR inventory.");
    }
    await assertPayoutReady(event.organizer_user_id, "organizer");
  }
}

export async function eventHasActiveTickets(eventId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("tickets")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ACTIVE_TICKET_STATUSES)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}

export async function assertDoorOpsEligible(eventId: string): Promise<void> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle<{ id: string; status: string }>();
  if (!event) throw new Error("Event not found.");
  if (event.status !== "published") {
    throw new Error("Xpress Door opens after the event is published.");
  }
  if (!(await eventHasActiveTickets(eventId))) {
    throw new Error("Xpress Door opens after tickets are generated.");
  }
}
