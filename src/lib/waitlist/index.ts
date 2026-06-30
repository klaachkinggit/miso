import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { sendWaitlistAvailable } from "@/lib/email/send";
import {
  organizationEventPath,
  organizationMarketplaceListingPath,
} from "@/lib/organizations/public";
import type { EventRow, EventWaitlist } from "@/types/db";

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function joinWaitlist(params: {
  eventId: string;
  userId: string;
}): Promise<EventWaitlist> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("event_waitlists")
    .upsert(
      { event_id: params.eventId, user_id: params.userId },
      { onConflict: "event_id,user_id", ignoreDuplicates: false },
    )
    .select("*")
    .single<EventWaitlist>();
  if (error || !data) throw error ?? new Error("Waitlist join failed");
  return data;
}

export async function leaveWaitlist(params: {
  eventId: string;
  userId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("event_waitlists")
    .delete()
    .eq("event_id", params.eventId)
    .eq("user_id", params.userId);
  if (error) throw error;
}

export async function getWaitlistEntry(params: {
  eventId: string;
  userId: string;
}): Promise<EventWaitlist | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("event_waitlists")
    .select("*")
    .eq("event_id", params.eventId)
    .eq("user_id", params.userId)
    .maybeSingle<EventWaitlist>();
  if (error) throw error;
  return data ?? null;
}

export async function isOnWaitlist(params: {
  eventId: string;
  userId: string;
}): Promise<boolean> {
  return (await getWaitlistEntry(params)) !== null;
}

export async function eventHasAvailability(params: {
  eventId: string;
}): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ticket_categories")
    .select("supply, sold_count, sales_enabled")
    .eq("event_id", params.eventId)
    .returns<
      Array<{ supply: number; sold_count: number; sales_enabled: boolean }>
    >();
  if (error) throw error;
  return (data ?? []).some(
    (category) =>
      category.sales_enabled && category.supply - category.sold_count > 0,
  );
}

// Notify the oldest entry that has never been notified, or whose 24h claim has
// lapsed. Stamps notified_at + claim_expires_at and emails the buyer. Must
// NEVER throw: it is awaited from settlement/refund/resale paths and a failure
// here must not roll back a release/refund or a listing creation.
//
// `source` decides where the email points: resale-freed inventory lives on the
// marketplace, not the event detail page, so a resale notification links to the
// specific listing. Refund/release freed inventory is bought from the event
// page.
export async function notifyWaitlistHead(params: {
  eventId: string;
  source?: "refund" | "release" | "resale";
  listingId?: string;
}): Promise<boolean> {
  try {
    const sb = createServiceClient();

    // Compare-and-swap claim: select an eligible head, then stamp it with the
    // SAME predicate the select used and require a returned row. If two callers
    // race the same head, only one UPDATE matches the still-eligible row; the
    // loser re-loops to the next eligible entry. Bounded so a fully-claimed
    // queue terminates.
    let head: EventWaitlist | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const lapsedBefore = new Date(Date.now()).toISOString();
      const { data: candidate } = await sb
        .from("event_waitlists")
        .select("*")
        .eq("event_id", params.eventId)
        .or(`notified_at.is.null,claim_expires_at.lt.${lapsedBefore}`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<EventWaitlist>();
      if (!candidate) return false;

      const now = Date.now();
      const { data: claimed } = await sb
        .from("event_waitlists")
        .update({
          notified_at: new Date(now).toISOString(),
          claim_expires_at: new Date(now + CLAIM_WINDOW_MS).toISOString(),
        })
        .eq("id", candidate.id)
        .or(`notified_at.is.null,claim_expires_at.lt.${lapsedBefore}`)
        .select("*")
        .maybeSingle<EventWaitlist>();
      if (claimed) {
        head = claimed;
        break;
      }
    }
    if (!head) return false;

    const { data: event } = await sb
      .from("events")
      .select("name, slug, organization_id")
      .eq("id", params.eventId)
      .maybeSingle<Pick<EventRow, "name" | "slug" | "organization_id">>();

    let eventUrl: string | undefined;
    if (event?.organization_id) {
      const { data: organization } = await sb
        .from("organizations")
        .select("slug")
        .eq("id", event.organization_id)
        .maybeSingle<{ slug: string }>();
      if (organization) {
        if (params.source === "resale" && params.listingId) {
          eventUrl = organizationMarketplaceListingPath(
            organization.slug,
            params.listingId,
          );
        } else if (event.slug) {
          eventUrl = organizationEventPath(organization.slug, event.slug);
        }
      }
    }

    await sendWaitlistAvailable({
      userId: head.user_id,
      eventName: event?.name ?? "your event",
      eventUrl,
    });

    return true;
  } catch (err) {
    console.error("[waitlist] notifyWaitlistHead failed", err);
    return false;
  }
}
