import Link from "next/link";
import { canOperateGateRole, canUseOrganizerWorkspace, getCurrentProfile } from "@/lib/auth";
import { isEmbedRequest } from "@/lib/embed/chrome";
import { getAdminOrganizationIds, getMemberOrganizationIds } from "@/lib/organizations/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/site/user-menu";

export async function Header() {
  if (await isEmbedRequest()) return null;
  const profile = await getCurrentProfile();
  const [adminOrganizationIds, memberOrganizationIds] = profile
    ? await Promise.all([getAdminOrganizationIds(profile.id), getMemberOrganizationIds(profile.id)])
    : [[], []];
  const controllerOnly = profile?.role === "controller";
  const canUseWorkspace =
    !!profile && (canUseOrganizerWorkspace(profile) || adminOrganizationIds.length > 0);
  const canUseGate =
    !!profile && (canOperateGateRole(profile) || memberOrganizationIds.length > 0);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-foreground"
          aria-label="MISO home"
        >
          <span className="ticker-mark" aria-hidden />
          <span className="font-mono text-[15px] font-medium tracking-[0.18em]">MISO</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] font-medium md:flex">
          {!controllerOnly ? (
            <>
              <Link
                href="/events"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Explore
              </Link>
              {profile ? (
                <Link
                  href="/tickets"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tickets
                </Link>
              ) : null}
              {canUseWorkspace ? (
                <Link
                  href="/admin"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Workspace
                </Link>
              ) : null}
            </>
          ) : null}
          {canUseGate ? (
            <Link
              href="/controller"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
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
                <Link href="/signup/organizer">Start free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
