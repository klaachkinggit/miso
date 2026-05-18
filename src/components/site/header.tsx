import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/site/user-menu";
import { Marquee } from "@/components/site/marquee";
import { HeroSearch } from "@/components/site/hero-search";

export async function Header() {
  const profile = await getCurrentProfile();
  const controllerOnly = profile?.role === "controller";

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

          <div className="hidden flex-1 justify-center px-4 lg:flex">
            <div className="w-full max-w-md">
              <HeroSearch size="md" />
            </div>
          </div>

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
        <div className="container pb-3 lg:hidden">
          <HeroSearch size="md" />
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
