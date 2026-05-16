// POST /api/controller/gates/[id]/close — close an open gate session.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { closeGateForController } from "@/lib/gates/operations";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let profile;
  try {
    profile = await requireApiControllerProfile();
  } catch (error) {
    return apiErrorResponse(error);
  }

  const { id } = await params;
  const session = await closeGateForController({ gateSessionId: id, profile });
  if (!session) return NextResponse.json({ error: "Gate not closeable." }, { status: 404 });
  return NextResponse.json(session);
}
