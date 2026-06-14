import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { getActiveOrganizationBySlug } from "@/lib/organizations/public";
import { getTheme } from "@/lib/organizations/theme";

export default async function StorefrontThemeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const [{ organizationSlug }, profile] = await Promise.all([params, getCurrentProfile()]);
  redirectIfCannotUseBuyerSurface(profile);

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const theme = getTheme(organization.theme);

  // Inline CSS vars cascade to this subtree only, overriding the :root defaults
  // from globals.css without affecting the admin/smartboard app. Server-rendered
  // in the first byte → no FOUC.
  const style: CSSProperties = {
    ...theme.cssVars,
    // Rebind the global font vars to the preset's stacks so .display / font-sans
    // pick them up; values still fall through to system stacks (offline-safe).
    "--font-display": theme.fontPair.heading,
    "--font-sans": theme.fontPair.body,
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
  } as CSSProperties;

  return (
    <div data-storefront-theme={theme.key} data-hero-layout={theme.heroLayout} style={style}>
      {children}
    </div>
  );
}
