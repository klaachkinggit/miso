import Link from "next/link";
import { canOperateGateRole, canUseOrganizerWorkspace, getCurrentProfile } from "@/lib/auth";
import { getAdminOrganizationIds, getMemberOrganizationIds } from "@/lib/organizations/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/site/user-menu";
import { Marquee } from "@/components/site/marquee";

export async function Header() {
  const profile = await getCurrentProfile();
  const [adminOrganizationIds, memberOrganizationIds] = profile
    ? await Promise.all([getAdminOrganizationIds(profile.id), getMemberOrganizationIds(profile.id)])
    : [[], []];
  const controllerOnly = profile?.role === "controller";
  const canUseWorkspace = !!profile && (canUseOrganizerWorkspace(profile) || adminOrganizationIds.length > 0);
  const canUseGate = !!profile && (canOperateGateRole(profile) || memberOrganizationIds.length > 0);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4 md:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-black tracking-tight">
            <span className="text-accent">●</span>
            MISO
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
            {!controllerOnly ? (
              <>
                {profile ? (
                  <Link href="/tickets" className="text-muted-foreground transition-colors hover:text-foreground">
                    Tickets
                  </Link>
                ) : null}
                {canUseWorkspace ? (
                  <Link href="/admin" className="text-muted-foreground transition-colors hover:text-foreground">
                    Workspace
                  </Link>
                ) : null}
              </>
            ) : null}
            {canUseGate ? (
              <Link href="/controller" className="text-muted-foreground transition-colors hover:text-foreground">
                Gate
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {profile ? (
              <UserMenu profile={profile} />
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <Marquee
        items={[
          "DIGITAL TICKETS · VERIFIED ACCESS",
          "FESTIVALS · CONCERTS · NIGHTLIFE",
          "OFFICIAL RESALE · ANTI-SCALPING",
          "VIP MEMBERSHIPS · TICKET WALLET",
        ]}
      />
    </>
  );
}
