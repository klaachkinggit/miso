// POST /api/controller/gates — open a new gate session for an event.
// GET  /api/controller/gates?event_id=... — list this controller's open gates.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { OpenGateSchema } from "@/lib/schemas";
import { listGatesForController, openGateForController } from "@/lib/gates/operations";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
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

  try {
    const session = await openGateForController({
      eventId: parsed.data.event_id,
      profile,
      gateName: parsed.data.gate_name ?? null,
      ttlHours: parsed.data.ttl_hours,
    });
    return NextResponse.json(session);
  } catch (error) {
    const message = getErrorMessage(error, "Could not open gate.");
    return NextResponse.json(
      { error: message },
      { status: message === "Not assigned to this event." ? 403 : 400 }
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

  try {
    const sessions = await listGatesForController({ eventId, profile });
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Could not list gates.") },
      { status: 403 }
    );
  }
}
