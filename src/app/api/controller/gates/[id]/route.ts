// GET /api/controller/gates/[id] — poll a gate session. Includes the most
// recent redemption row so the controller UI can render approved/denied
// without holding open a websocket.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getGatePollForController } from "@/lib/gates/operations";

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
  let poll;
  try {
    poll = await getGatePollForController({ gateSessionId: id, profile });
  } catch {
    return NextResponse.json({ error: "Not your gate." }, { status: 403 });
  }

  if (!poll) return NextResponse.json({ error: "Gate not found." }, { status: 404 });
  return NextResponse.json(poll);
}
