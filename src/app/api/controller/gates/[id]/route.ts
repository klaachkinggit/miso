// GET /api/controller/gates/[id] — poll a gate session. Includes the most
// recent redemption row so the controller UI can render approved/denied
// without holding open a websocket.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiControllerProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { getGatePollForController } from "@/lib/gates/operations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireApiControllerProfile();
    const { id } = await params;
    const poll = await getGatePollForController({ gateSessionId: id, profile });
    if (!poll) return NextResponse.json({ error: "Gate not found." }, { status: 404 });
    return NextResponse.json(poll);
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return NextResponse.json({ error: "Not your gate." }, { status: 403 });
  }
}
