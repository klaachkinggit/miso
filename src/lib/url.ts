import type { NextRequest } from "next/server";

export function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");

  if (!host) return request.nextUrl.origin;

  const proto = forwardedProto || request.nextUrl.protocol.replace(/:$/, "") || "http";
  return `${proto}://${host}`;
}
