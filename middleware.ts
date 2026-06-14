import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseCtor } from "next/server";
import { customDomainRewriteUrl, storefrontRewriteUrl } from "@/lib/organizations/hosts";
import { updateSession } from "@/lib/supabase/middleware";

function applyFrameHeaders(response: NextResponse, pathname: string) {
  // /embed/* is a publicly embeddable widget by design; every other route stays
  // frame-protected so this change can't open the rest of the app to clickjacking.
  if (pathname === "/embed" || pathname.startsWith("/embed/")) {
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response } = await updateSession(request);
  response.headers.set("x-pathname", pathname);
  applyFrameHeaders(response, pathname);

  // A miso storefront subdomain rewrites synchronously (pure string parse). A
  // verified org custom domain needs a DB lookup; only attempt it when the host
  // is NOT already a known storefront host (customDomainRewriteUrl enforces that).
  const rewriteUrl = storefrontRewriteUrl(request) ?? (await customDomainRewriteUrl(request));
  if (!rewriteUrl) return response;

  // Forward x-pathname on the REQUEST so RSC `headers()` reads it after the rewrite.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const rewriteResponse = NextResponseCtor.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
  for (const cookie of response.cookies.getAll()) {
    rewriteResponse.cookies.set(cookie);
  }
  rewriteResponse.headers.set("x-pathname", pathname);
  applyFrameHeaders(rewriteResponse, pathname);
  return rewriteResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/.*|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)).*)",
  ],
};
