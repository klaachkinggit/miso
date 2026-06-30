import type { NextRequest } from "next/server";
import { isStorefrontHost } from "@/lib/organizations/hosts";

// Trust order (defends against Host / x-forwarded-host spoofing):
//
//   1. For non-local requests, APP_URL / NEXT_PUBLIC_APP_URL env wins.
//      In production this is the canonical origin and any attacker-
//      controlled header is ignored.
//   2. x-forwarded-host is only honored when its host is in the
//      TRUSTED_FORWARDED_HOSTS allowlist (comma-separated).
//   3. Otherwise we fall back to request.nextUrl.origin, which uses
//      the Host header. Acceptable for local dev / direct browser
//      requests; production should always set APP_URL.
//
// Local dev (localhost/127.0.0.1) intentionally ignores APP_URL so a
// developer can run on a port the env wasn't pinned to. A spoofed Host
// header could in theory point at localhost from a non-local request,
// but a remote attacker can't make a real browser send Host: localhost.
function isLocalHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]!.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

function trustedForwardedHost(host: string | undefined): boolean {
  if (!host) return false;
  const allowlist = (process.env.TRUSTED_FORWARDED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;
  return allowlist.includes(host.toLowerCase());
}

export function getRequestOrigin(request: NextRequest): string {
  const rawHost = request.headers.get("host") ?? request.nextUrl.host;

  if (isStorefrontHost(rawHost)) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      request.nextUrl.protocol.replace(/:$/, "") ||
      "https";
    return `${proto}://${rawHost}`;
  }

  if (!isLocalHost(rawHost)) {
    const envOrigin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
    if (envOrigin) return envOrigin.replace(/\/+$/, "");
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost && trustedForwardedHost(forwardedHost)) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const proto =
      forwardedProto || request.nextUrl.protocol.replace(/:$/, "") || "https";
    return `${proto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getConfiguredAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3002"
  ).replace(/\/+$/, "");
}
