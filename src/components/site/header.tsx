import Link from "next/link";
import { Search } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { listAccountBalances } from "@/lib/balances/ledger";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/site/user-menu";
import { Marquee } from "@/components/site/marquee";

export async function Header() {
  const profile = await getCurrentProfile();
  const controllerOnly = profile?.role === "controller";
  const balances = profile && !controllerOnly ? await listAccountBalances(profile.id) : [];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="text-accent">●</span>
              MISO
            </Link>

            <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
              {!controllerOnly ? (
                <>
                  <Link href="/events" className="text-muted-foreground transition-colors hover:text-foreground">
                    Events
                  </Link>
                  <Link href="/marketplace" className="text-muted-foreground transition-colors hover:text-foreground">
                    Exchange
                  </Link>
                  {profile ? (
                    <Link href="/tickets" className="text-muted-foreground transition-colors hover:text-foreground">
                      Wallet
                    </Link>
                  ) : null}
                  {profile?.role === "admin" ? (
                    <Link href="/admin" className="text-muted-foreground transition-colors hover:text-foreground">
                      Admin
                    </Link>
                  ) : null}
                </>
              ) : null}
              {profile?.role === "controller" || profile?.role === "admin" ? (
                <Link href="/controller" className="text-muted-foreground transition-colors hover:text-foreground">
                  Gate
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/events"
              aria-label="Search events"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Link>
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

      <Marquee
        items={[
          "NFT TICKETS · VERIFIED ACCESS",
          "FESTIVALS · CONCERTS · NIGHTLIFE",
          "OFFICIAL RESALE · ANTI-SCALPING",
          "VIP MEMBERSHIPS · EVENT WALLET",
        ]}
      />
    </>
  );
}
