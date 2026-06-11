import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, OrganizationRole, Profile } from "@/types/db";

export type AuthProfile = Pick<Profile, "id" | "role">;
export type EventAuthScope = Pick<EventRow, "organization_id" | "organizer_user_id">;

export function isOrganizationControllerOnly(role: OrganizationRole | null): boolean {
  return role === "controller";
}

export function shouldUseLegacyOrganizerEventScope(
  profile: AuthProfile,
  hasOrganizationScope: boolean,
): boolean {
  return !hasOrganizationScope && profile.role === "organizer";
}

export function canManageEventWithRole(
  profile: AuthProfile,
  event: EventAuthScope,
  organizationRole: OrganizationRole | null,
): boolean {
  if (profile.role === "admin") return true;
  if (event.organization_id) return organizationRole === "admin";
  return profile.role === "organizer" && event.organizer_user_id === profile.id;
}

export function canOperateEventGateWithRole(
  profile: AuthProfile,
  event: EventAuthScope,
  organizationRole: OrganizationRole | null,
  hasControllerAssignment: boolean,
): boolean {
  if (profile.role === "admin") return true;
  if (event.organization_id) {
    if (organizationRole === "admin") return true;
    return organizationRole === "controller" && hasControllerAssignment;
  }
  return profile.role === "controller" && hasControllerAssignment;
}

export async function getOrganizationRole(
  userId: string,
  organizationId: string | null | undefined,
): Promise<OrganizationRole | null> {
  if (!organizationId) return null;
  const sb = createServiceClient();
  const { data } = await sb
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle<{ role: OrganizationRole }>();
  return data?.role ?? null;
}

export async function getDefaultAdminOrganizationId(userId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();
  return data?.organization_id ?? null;
}

export async function getAdminOrganizationIds(userId: string): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .returns<Array<{ organization_id: string }>>();
  return data?.map((row) => row.organization_id) ?? [];
}

export async function getMemberOrganizationIds(userId: string): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<Array<{ organization_id: string }>>();
  return data?.map((row) => row.organization_id) ?? [];
}

export async function hasAdminOrganization(userId: string): Promise<boolean> {
  return !!(await getDefaultAdminOrganizationId(userId));
}

export async function getEventAuthScope(eventId: string): Promise<EventAuthScope | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("events")
    .select("organization_id, organizer_user_id")
    .eq("id", eventId)
    .maybeSingle<EventAuthScope>();
  return data ?? null;
}

export async function canManageEvent(profile: AuthProfile, event: EventAuthScope): Promise<boolean> {
  const role = await getOrganizationRole(profile.id, event.organization_id);
  return canManageEventWithRole(profile, event, role);
}

async function hasEventControllerAssignment(userId: string, eventId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("event_controllers")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle<{ event_id: string }>();
  return !!data;
}

export async function canOperateEventGate(params: {
  eventId: string;
  profile: AuthProfile;
}): Promise<boolean> {
  const event = await getEventAuthScope(params.eventId);
  if (!event) return false;
  const [role, assigned] = await Promise.all([
    getOrganizationRole(params.profile.id, event.organization_id),
    hasEventControllerAssignment(params.profile.id, params.eventId),
  ]);
  return canOperateEventGateWithRole(params.profile, event, role, assigned);
}

export async function canAdministerEventGate(params: {
  eventId: string;
  profile: AuthProfile;
}): Promise<boolean> {
  const event = await getEventAuthScope(params.eventId);
  if (!event) return false;
  const role = await getOrganizationRole(params.profile.id, event.organization_id);
  if (params.profile.role === "admin") return true;
  if (event.organization_id) return role === "admin";
  return false;
}

export async function isOrganizationControllerForUser(
  userId: string,
  organizationId: string | null | undefined,
): Promise<boolean> {
  return isOrganizationControllerOnly(await getOrganizationRole(userId, organizationId));
}

export async function getOrganizationIdForCategory(categoryId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data: category } = await sb
    .from("ticket_categories")
    .select("event_id")
    .eq("id", categoryId)
    .maybeSingle<{ event_id: string }>();
  if (!category) return null;
  const event = await getEventAuthScope(category.event_id);
  return event?.organization_id ?? null;
}

export async function getOrganizationIdForTicket(ticketId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data: ticket } = await sb
    .from("tickets")
    .select("event_id")
    .eq("id", ticketId)
    .maybeSingle<{ event_id: string }>();
  if (!ticket) return null;
  const event = await getEventAuthScope(ticket.event_id);
  return event?.organization_id ?? null;
}

export async function getOrganizationIdForListing(listingId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data: listing } = await sb
    .from("resale_listings")
    .select("organization_id, ticket_id")
    .eq("id", listingId)
    .maybeSingle<{ organization_id: string | null; ticket_id: string }>();
  if (!listing) return null;
  return listing.organization_id ?? getOrganizationIdForTicket(listing.ticket_id);
}

// Deep dispatcher so callers don't thread which-lookup-per-entity. Each
// branch is the same 2-step (entity → event → org) the per-entity helpers
// already do; consolidating the dispatch removes the friction the
// architecture review flagged (candidate #3).
export type OrganizationOwnedResource =
  | { kind: "category"; id: string }
  | { kind: "ticket"; id: string }
  | { kind: "listing"; id: string };

export function resourceOrganizationId(resource: OrganizationOwnedResource): Promise<string | null> {
  switch (resource.kind) {
    case "category":
      return getOrganizationIdForCategory(resource.id);
    case "ticket":
      return getOrganizationIdForTicket(resource.id);
    case "listing":
      return getOrganizationIdForListing(resource.id);
  }
}
