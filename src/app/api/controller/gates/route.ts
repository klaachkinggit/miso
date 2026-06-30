// POST /api/controller/gates — open a new gate session for an event.
// GET  /api/controller/gates?event_id=... — list this controller's open gates.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { OpenGateSchema } from "@/lib/schemas";
import {
  listGatesForController,
  openGateForController,
} from "@/lib/gates/operations";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    const body = await parseJsonBody(
      request,
      OpenGateSchema,
      "Invalid gate payload.",
    );
    const session = await openGateForController({
      eventId: body.event_id,
      profile,
      gateName: body.gate_name ?? null,
      allowedCategoryIds: body.allowed_category_ids ?? null,
      ttlHours: body.ttl_hours,
    });
    return NextResponse.json(session);
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Could not open gate." });
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    const eventId = request.nextUrl.searchParams.get("event_id");
    if (!eventId) throw new ApiRouteError("event_id required.", 400);

    const sessions = await listGatesForController({ eventId, profile });
    return NextResponse.json({ sessions });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Could not list gates." });
  }
}
