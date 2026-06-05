import type { NextRequest } from "next/server";

import { normalizeStorefrontSlug } from "@/lib/organizations/slugs";

const DEFAULT_STOREFRONT_ROOT_DOMAINS = ["miso.com", "shop.miso.com"];
const DEV_STOREFRONT_ROOT_DOMAINS = ["localhost"];
export const RESERVED_STOREFRONT_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "cdn",
  "controller",
  "login",
  "signup",
  "static",
  "support",
  "www",
  "shop",
]);

const STOREFRONT_REWRITE_PREFIXES = ["/events", "/marketplace"];

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => normalizeHost(value))
    .filter((value): value is string => Boolean(value));
}

export function normalizeHost(value: string | null | undefined): string | null {
  const host = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!host) return null;
  const withoutProtocol = host.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  if (withoutPath.startsWith("[")) return withoutPath;
  return withoutPath.split(":")[0] || null;
}

export function storefrontRootDomains(): string[] {
  const configured = envList("MISO_STOREFRONT_ROOT_DOMAINS");
  const roots = configured.length
    ? configured
    : [
        ...DEFAULT_STOREFRONT_ROOT_DOMAINS,
        ...(process.env.NODE_ENV === "production" ? [] : DEV_STOREFRONT_ROOT_DOMAINS),
      ];
  return [...new Set(roots)].sort((a, b) => b.length - a.length);
}

export function storefrontSlugFromHost(hostValue: string | null | undefined): string | null {
  const host = normalizeHost(hostValue);
  if (!host) return null;

  for (const root of storefrontRootDomains()) {
    if (host === root) return null;
    if (!host.endsWith(`.${root}`)) continue;

    const rawSubdomain = host.slice(0, -(root.length + 1));
    if (rawSubdomain.includes(".")) return null;
    const slug = normalizeStorefrontSlug(rawSubdomain);
    if (!slug || RESERVED_STOREFRONT_SUBDOMAINS.has(slug)) return null;
    return slug;
  }

  return null;
}

export function isReservedStorefrontSlug(value: string | null | undefined): boolean {
  const slug = normalizeStorefrontSlug(value ?? undefined);
  return Boolean(slug && RESERVED_STOREFRONT_SUBDOMAINS.has(slug));
}

export function isStorefrontHost(hostValue: string | null | undefined): boolean {
  return storefrontSlugFromHost(hostValue) !== null;
}

export function storefrontPathForHost(
  organizationSlug: string,
  fallbackPath: string,
  subdomainPath: string,
  hostValue: string | null | undefined,
): string {
  return storefrontSlugFromHost(hostValue) === organizationSlug ? subdomainPath : fallbackPath;
}

export function organizationStorefrontOrigin(organizationSlug: string): string {
  const root = normalizeHost(process.env.MISO_STOREFRONT_CANONICAL_ROOT_DOMAIN) ?? "miso.com";
  return `https://${organizationSlug}.${root}`;
}

export function storefrontRewritePath(pathname: string, organizationSlug: string): string | null {
  if (pathname === "/") return `/s/${organizationSlug}`;
  if (pathname.startsWith("/s/")) return null;
  if (pathname.startsWith("/api/")) return null;
  if (!STOREFRONT_REWRITE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }
  return `/s/${organizationSlug}${pathname}`;
}

export function storefrontRewriteUrl(request: NextRequest): URL | null {
  const slug = storefrontSlugFromHost(request.headers.get("host") ?? request.nextUrl.host);
  if (!slug) return null;

  const rewritePath = storefrontRewritePath(request.nextUrl.pathname, slug);
  if (!rewritePath) return null;

  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  return url;
}
