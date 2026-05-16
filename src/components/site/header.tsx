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
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-black/85 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="text-[hsl(var(--accent))]">●</span>
              MISO
            </Link>

            <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
              {!controllerOnly ? (
                <>
                  <Link href="/events" className="text-white/80 transition-colors hover:text-white">
                    Events
                  </Link>
                  <Link href="/marketplace" className="text-white/80 transition-colors hover:text-white">
                    Resale
                  </Link>
                  {profile ? (
                    <Link href="/tickets" className="text-white/80 transition-colors hover:text-white">
                      My tickets
                    </Link>
                  ) : null}
                  {profile?.role === "admin" ? (
                    <Link href="/admin" className="text-white/80 transition-colors hover:text-white">
                      Admin
                    </Link>
                  ) : null}
                </>
              ) : null}
              {profile?.role === "controller" || profile?.role === "admin" ? (
                <Link href="/controller" className="text-white/80 transition-colors hover:text-white">
                  Gate
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/events"
              aria-label="Search events"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.06]"
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
          "● LIVE TICKETING ON-CHAIN",
          "TAP TO ENTER · NO QR · NO SCREENSHOT",
          "ERC-721 ON BASE",
          "BUY · HOLD · RESELL · REDEEM",
        ]}
      />
    </>
  );
}
