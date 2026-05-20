// POST /api/controller/gates/[id]/close — close an open gate session.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiControllerProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { closeGateForController } from "@/lib/gates/operations";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireApiControllerProfile();
    const { id } = await params;
    const session = await closeGateForController({ gateSessionId: id, profile });
    if (!session) throw new ApiRouteError("Gate not closeable.", 404);
    return NextResponse.json(session);
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Could not close gate." });
  }
}
