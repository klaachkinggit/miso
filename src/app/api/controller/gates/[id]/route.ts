// GET /api/controller/gates/[id] — poll a gate session. Includes the most
// recent redemption row so the controller UI can render approved/denied
// without holding open a websocket.

import { NextResponse, type NextRequest } from "next/server";
import {
  assertCanUseGateApi,
  requireApiAuthenticatedProfile,
} from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { getGatePollForController } from "@/lib/gates/operations";
import { currentGateToken } from "@/lib/gates/rotating-token";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    await assertCanUseGateApi(profile);
    const { id } = await params;
    const poll = await getGatePollForController({ gateSessionId: id, profile });
    if (!poll) throw new ApiRouteError("Gate not found.", 404);
    return NextResponse.json({ ...poll, rotatingToken: currentGateToken(id) });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Could not load gate." });
  }
}
