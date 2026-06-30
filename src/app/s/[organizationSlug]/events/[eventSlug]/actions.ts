"use server";

import { revalidatePath } from "next/cache";

import { getPublishedEventByOrganizationSlug } from "@/lib/events/public";
import { getActiveOrganizationBySlug } from "@/lib/organizations/public";
import { joinWaitlist, leaveWaitlist } from "@/lib/waitlist";
import { requireBuyer } from "../../buyer";

// Resolve the event server-side from the route slugs the buyer was actually
// shown — never trust a client-supplied eventId, or an authenticated user
// could seed waitlist rows (and self-target emails) on arbitrary/unpublished
// events. Returns the verified, published event id.
async function resolveVisibleEventId(input: {
  organizationSlug: string;
  eventSlug: string;
}): Promise<string> {
  const organization = await getActiveOrganizationBySlug(
    input.organizationSlug,
  );
  if (!organization) throw new Error("Event not found.");
  const event = await getPublishedEventByOrganizationSlug({
    organizationId: organization.id,
    eventSlug: input.eventSlug,
  });
  if (!event) throw new Error("Event not found.");
  return event.id;
}

export async function joinWaitlistAction(input: {
  organizationSlug: string;
  eventSlug: string;
  path: string;
}): Promise<void> {
  const profile = await requireBuyer("Sign in as a buyer to use the waitlist.");
  const eventId = await resolveVisibleEventId(input);
  await joinWaitlist({ eventId, userId: profile.id });
  revalidatePath(input.path);
}

export async function leaveWaitlistAction(input: {
  organizationSlug: string;
  eventSlug: string;
  path: string;
}): Promise<void> {
  const profile = await requireBuyer("Sign in as a buyer to use the waitlist.");
  const eventId = await resolveVisibleEventId(input);
  await leaveWaitlist({ eventId, userId: profile.id });
  revalidatePath(input.path);
}
