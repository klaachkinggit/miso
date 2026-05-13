// POST /api/controller/gates/[id]/close — close an open gate session.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { closeGateForController } from "@/lib/gates/operations";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["controller", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Controller role required." }, { status: 403 });
  }

  const { id } = await params;
  const session = await closeGateForController({ gateSessionId: id, profile });
  if (!session) return NextResponse.json({ error: "Gate not closeable." }, { status: 404 });
  return NextResponse.json(session);
}
