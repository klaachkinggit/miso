// POST /api/controller/gates — open a new gate session for an event.
// GET  /api/controller/gates?event_id=... — list this controller's open gates.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { OpenGateSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { openGateSession } from "@/lib/gates/session";
import type { GateSession } from "@/types/db";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

async function assertController(eventId: string, userId: string, role: string) {
  if (role === "admin") return true;
  const sb = createServiceClient();
  const { data } = await sb
    .from("event_controllers")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["controller", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Controller role required." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = OpenGateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid gate payload." }, { status: 400 });

  const allowed = await assertController(parsed.data.event_id, profile.id, profile.role);
  if (!allowed) return NextResponse.json({ error: "Not assigned to this event." }, { status: 403 });

  try {
    const session = await openGateSession({
      eventId: parsed.data.event_id,
      controllerUserId: profile.id,
      gateName: parsed.data.gate_name ?? null,
      ttlHours: parsed.data.ttl_hours,
    });
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Could not open gate.") },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["controller", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Controller role required." }, { status: 403 });
  }

  const eventId = request.nextUrl.searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "event_id required." }, { status: 400 });

  const allowed = await assertController(eventId, profile.id, profile.role);
  if (!allowed) return NextResponse.json({ error: "Not assigned to this event." }, { status: 403 });

  const sb = createServiceClient();
  let query = sb
    .from("gate_sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("opened_at", { ascending: false })
    .limit(20);

  if (profile.role !== "admin") {
    query = query.eq("controller_user_id", profile.id);
  }

  const { data } = await query.returns<GateSession[]>();

  return NextResponse.json({ sessions: data ?? [] });
}
