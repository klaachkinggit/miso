import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { storefrontRewriteUrl } from "@/lib/organizations/hosts";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response } = await updateSession(request);
  const rewriteUrl = storefrontRewriteUrl(request);
  if (!rewriteUrl) return response;

  const rewriteResponse = NextResponse.rewrite(rewriteUrl, { request });
  for (const cookie of response.cookies.getAll()) {
    rewriteResponse.cookies.set(cookie);
  }
  return rewriteResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/.*|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)).*)",
  ],
};
