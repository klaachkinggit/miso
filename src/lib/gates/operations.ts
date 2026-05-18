import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { GateSession, Profile, Ticket, TicketRedemption } from "@/types/db";

const GATE_TTL_HOURS = 8;
const SHORT_CODE_LEN = 8;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface GatePoll {
  session: GateSession;
  last_redemption: TicketRedemption | null;
  last_ticket: Pick<Ticket, "id" | "serial_number" | "status"> | null;
}

function generateShortCode(len = SHORT_CODE_LEN): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function isGateSessionUsable(session: GateSession): boolean {
  if (session.status !== "open") return false;
  return new Date(session.expires_at).getTime() > Date.now();
}

export function gateAllowsTicketCategory(
  session: Pick<GateSession, "allowed_category_ids">,
  categoryId: string,
): boolean {
  return !session.allowed_category_ids?.length || session.allowed_category_ids.includes(categoryId);
}

export async function canOperateEventGate(params: {
  eventId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<boolean> {
  if (params.profile.role === "admin") return true;
  if (params.profile.role !== "controller") return false;

  const sb = createServiceClient();
  const { data } = await sb
    .from("event_controllers")
    .select("event_id")
    .eq("event_id", params.eventId)
    .eq("user_id", params.profile.id)
    .maybeSingle();
  return !!data;
}

async function requireEventGateOperator(params: {
  eventId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<void> {
  const allowed = await canOperateEventGate(params);
  if (!allowed) throw new Error("Not assigned to this event.");
}

function normalizeAllowedCategoryIds(categoryIds?: string[] | null): string[] {
  return Array.from(new Set(categoryIds?.filter(Boolean) ?? []));
}

async function requireEventCategories(params: {
  eventId: string;
  categoryIds?: string[] | null;
}): Promise<string[] | null> {
  const categoryIds = normalizeAllowedCategoryIds(params.categoryIds);
  if (categoryIds.length === 0) return null;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ticket_categories")
    .select("id")
    .eq("event_id", params.eventId)
    .in("id", categoryIds)
    .returns<Array<{ id: string }>>();
  if (error) throw new Error(error.message);

  if ((data ?? []).length !== categoryIds.length) {
    throw new Error("One or more ticket categories are not part of this event.");
  }

  return categoryIds;
}

export async function getGateSessionByShortCode(code: string): Promise<GateSession | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gate_sessions")
    .select("*")
    .eq("short_code", code.trim().toUpperCase())
    .maybeSingle<GateSession>();
  return data;
}

export async function openGateForController(params: {
  eventId: string;
  profile: Pick<Profile, "id" | "role">;
  gateName?: string | null;
  allowedCategoryIds?: string[] | null;
  ttlHours?: number;
}): Promise<GateSession> {
  await requireEventGateOperator({ eventId: params.eventId, profile: params.profile });

  const sb = createServiceClient();
  const ttl = (params.ttlHours ?? GATE_TTL_HOURS) * 3600 * 1000;
  const expires_at = new Date(Date.now() + ttl).toISOString();
  const allowed_category_ids = await requireEventCategories({
    eventId: params.eventId,
    categoryIds: params.allowedCategoryIds,
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    const short_code = generateShortCode();
    const { data, error } = await sb
      .from("gate_sessions")
      .insert({
        event_id: params.eventId,
        controller_user_id: params.profile.id,
        gate_name: params.gateName ?? null,
        allowed_category_ids,
        short_code,
        status: "open",
        expires_at,
      })
      .select("*")
      .single<GateSession>();
    if (data) return data;
    if (error) {
      const message = error.message || "Could not open gate.";
      if (!message.toLowerCase().includes("duplicate")) throw new Error(message);
    }
  }

  throw new Error("Could not allocate gate short_code");
}

export async function listGatesForController(params: {
  eventId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<GateSession[]> {
  await requireEventGateOperator({ eventId: params.eventId, profile: params.profile });

  const sb = createServiceClient();
  let query = sb
    .from("gate_sessions")
    .select("*")
    .eq("event_id", params.eventId)
    .order("opened_at", { ascending: false })
    .limit(20);

  if (params.profile.role !== "admin") {
    query = query.eq("controller_user_id", params.profile.id);
  }

  const { data } = await query.returns<GateSession[]>();
  return data ?? [];
}

export async function getGatePollForController(params: {
  gateSessionId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<GatePoll | null> {
  const sb = createServiceClient();
  const { data: session } = await sb
    .from("gate_sessions")
    .select("*")
    .eq("id", params.gateSessionId)
    .maybeSingle<GateSession>();

  if (!session) return null;
  if (params.profile.role !== "admin" && session.controller_user_id !== params.profile.id) {
    throw new Error("Not your gate.");
  }

  let last_redemption: TicketRedemption | null = null;
  let last_ticket: Pick<Ticket, "id" | "serial_number" | "status"> | null = null;

  if (session.last_redemption_id) {
    const { data } = await sb
      .from("ticket_redemptions")
      .select("*")
      .eq("id", session.last_redemption_id)
      .maybeSingle<TicketRedemption>();
    last_redemption = data;
  }

  if (session.last_ticket_id) {
    const { data } = await sb
      .from("tickets")
      .select("id, serial_number, status")
      .eq("id", session.last_ticket_id)
      .maybeSingle<Pick<Ticket, "id" | "serial_number" | "status">>();
    last_ticket = data;
  }

  return { session, last_redemption, last_ticket };
}

export async function closeGateForController(params: {
  gateSessionId: string;
  profile: Pick<Profile, "id" | "role">;
}): Promise<GateSession | null> {
  const sb = createServiceClient();
  let query = sb
    .from("gate_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", params.gateSessionId)
    .eq("status", "open");

  if (params.profile.role !== "admin") {
    query = query.eq("controller_user_id", params.profile.id);
  }

  const { data } = await query.select("*").maybeSingle<GateSession>();
  return data;
}

export async function updateGateLastRedemption(params: {
  gateSessionId: string;
  redemptionId: string;
  ticketId: string;
  result: string;
}): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("gate_sessions")
    .update({
      last_redemption_id: params.redemptionId,
      last_ticket_id: params.ticketId,
      last_result: params.result,
    })
    .eq("id", params.gateSessionId);
}
