import Link from "next/link";
import { Ticket } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { listAccountBalances } from "@/lib/balances/ledger";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/site/user-menu";

export async function Header() {
  const profile = await getCurrentProfile();
  const controllerOnly = profile?.role === "controller";
  const balances = profile && !controllerOnly ? await listAccountBalances(profile.id) : [];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ticket className="h-5 w-5" />
          </span>
          <span className="gradient-text text-lg">Miso</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {!controllerOnly ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/events">Events</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/marketplace">Marketplace</Link>
              </Button>
            </>
          ) : null}
          {profile && !controllerOnly ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tickets">My tickets</Link>
            </Button>
          ) : null}
          {profile?.role === "controller" || profile?.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/controller">Controller</Link>
            </Button>
          ) : null}
          {profile?.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {profile ? (
            <UserMenu profile={profile} balances={balances} />
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
  );
}
