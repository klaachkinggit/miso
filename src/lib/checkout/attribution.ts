import type { NextRequest } from "next/server";

import { storefrontSlugFromHost } from "@/lib/organizations/hosts";
import type { SalesChannel } from "@/types/db";

const TRACKING_ORIGIN_MAX_LENGTH = 512;

function trimTrackingOrigin(value: string): string {
  return value.slice(0, TRACKING_ORIGIN_MAX_LENGTH);
}

export function sourcePathFromReturnPath(returnPath: string | null | undefined): string | null {
  if (!returnPath) return null;
  const path = returnPath.split("?")[0] ?? "";
  return path.startsWith("/") ? path : null;
}

export function checkoutTrackingOrigin(request: NextRequest, sourcePath: string | null): string {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const slug = storefrontSlugFromHost(host);
  const path = sourcePath ?? request.nextUrl.pathname;
  const normalizedPath = slug && path.startsWith(`/s/${slug}`)
    ? path.slice(`/s/${slug}`.length) || "/"
    : path;
  const origin = slug ? `host:${slug} path:${normalizedPath}` : `path:${path}`;
  return trimTrackingOrigin(origin);
}

export function checkoutSalesChannel(kind: "primary" | "resale"): SalesChannel {
  return kind === "resale" ? "marketplace" : "mini_site";
}

