// Gate sessions — the controller-initiated "lane" that a customer redeems into.
//
// A gate session lives for a few hours, has a short_code that opens the
// public redemption page (`/redeem/<short_code>`), and tracks the most recent
// redemption so the controller UI can poll it and show approved/denied.

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { GateSession } from "@/types/db";

const GATE_TTL_HOURS = 8;
const SHORT_CODE_LEN = 8;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateShortCode(len = SHORT_CODE_LEN): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function openGateSession(params: {
  eventId: string;
  controllerUserId: string;
  gateName?: string | null;
  ttlHours?: number;
}): Promise<GateSession> {
  const sb = createServiceClient();
  const ttl = (params.ttlHours ?? GATE_TTL_HOURS) * 3600 * 1000;
  const expires_at = new Date(Date.now() + ttl).toISOString();

  // Retry on short_code collision (vanishingly rare with 31^8 keyspace).
  for (let attempt = 0; attempt < 4; attempt++) {
    const short_code = generateShortCode();
    const { data, error } = await sb
      .from("gate_sessions")
      .insert({
        event_id: params.eventId,
        controller_user_id: params.controllerUserId,
        gate_name: params.gateName ?? null,
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

export async function getGateSessionByShortCode(code: string): Promise<GateSession | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gate_sessions")
    .select("*")
    .eq("short_code", code.trim().toUpperCase())
    .maybeSingle<GateSession>();
  return data;
}

export async function getGateSessionById(id: string): Promise<GateSession | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gate_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<GateSession>();
  return data;
}

export function isGateSessionUsable(session: GateSession): boolean {
  if (session.status !== "open") return false;
  return new Date(session.expires_at).getTime() > Date.now();
}

export async function closeGateSession(
  id: string,
  controllerUserId: string,
  options: { allowAnyController?: boolean } = {}
): Promise<GateSession | null> {
  const sb = createServiceClient();
  let query = sb
    .from("gate_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");

  if (!options.allowAnyController) {
    query = query.eq("controller_user_id", controllerUserId);
  }

  const { data } = await query.select("*").maybeSingle<GateSession>();
  return data;
}

export async function expireStaleGateSessions(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gate_sessions")
    .update({ status: "expired", closed_at: new Date().toISOString() })
    .eq("status", "open")
    .lt("expires_at", new Date().toISOString())
    .select("id");
  return data?.length ?? 0;
}

export async function updateGateLastRedemption(params: {
  gateSessionId: string;
  redemptionId: string;
  ticketId: string;
  result: string;
}) {
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
