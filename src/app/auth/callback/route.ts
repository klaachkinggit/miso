import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/events";

  if (code) {
    const sb = await createClient();
    await sb.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
