// POST /api/controller/gates — open a new gate session for an event.
// GET  /api/controller/gates?event_id=... — list this controller's open gates.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiControllerProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse, errorMessage } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { OpenGateSchema } from "@/lib/schemas";
import { listGatesForController, openGateForController } from "@/lib/gates/operations";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiControllerProfile();
    const body = await parseJsonBody(request, OpenGateSchema, "Invalid gate payload.");
    const session = await openGateForController({
      eventId: body.event_id,
      profile,
      gateName: body.gate_name ?? null,
      ttlHours: body.ttl_hours,
    });
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    const message = errorMessage(error, "Could not open gate.");
    return NextResponse.json(
      { error: message },
      { status: message === "Not assigned to this event." ? 403 : 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireApiControllerProfile();
    const eventId = request.nextUrl.searchParams.get("event_id");
    if (!eventId) return NextResponse.json({ error: "event_id required." }, { status: 400 });

    const sessions = await listGatesForController({ eventId, profile });
    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return NextResponse.json(
      { error: errorMessage(error, "Could not list gates.") },
      { status: 403 }
    );
  }
}
