import { NextResponse, type NextRequest } from "next/server";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// configured on the project. Fail closed: with no secret set the endpoint is
// unreachable rather than world-callable.
export function cronAuthError(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return null;
}
