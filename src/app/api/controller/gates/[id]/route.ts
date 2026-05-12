// GET /api/controller/gates/[id] — poll a gate session. Includes the most
// recent redemption row so the controller UI can render approved/denied
// without holding open a websocket.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { GateSession, TicketRedemption, Ticket } from "@/types/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["controller", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Controller role required." }, { status: 403 });
  }

  const { id } = await params;
  const sb = createServiceClient();
  const { data: session } = await sb
    .from("gate_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<GateSession>();

  if (!session) return NextResponse.json({ error: "Gate not found." }, { status: 404 });
  if (profile.role !== "admin" && session.controller_user_id !== profile.id) {
    return NextResponse.json({ error: "Not your gate." }, { status: 403 });
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

  return NextResponse.json({ session, last_redemption, last_ticket });
}
