"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";

const ITEMS = [
  { href: "/tickets", label: "Wallet", icon: Ticket, match: (p: string) => p.startsWith("/tickets") },
];

const HIDDEN_PREFIXES = ["/admin", "/controller", "/login", "/signup", "/checkout", "/redeem", "/s/"];
const HIDDEN_EXACT = ["/"];

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const isEventDetail = /^\/events\/[^/]+$/.test(pathname);
  const isMarketplaceDetail = /^\/marketplace\/[^/]+$/.test(pathname);
  if (
    HIDDEN_EXACT.includes(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) ||
    isEventDetail ||
    isMarketplaceDetail
  ) {
    return null;
  }
  return (
    <>
      <div aria-hidden="true" className="h-16 md:hidden" />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      >
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "flex h-full flex-1 flex-col items-center justify-center gap-1 " +
                (active ? "text-primary" : "text-muted-foreground")
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
