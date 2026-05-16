"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Search, Ticket, User } from "lucide-react";

const ITEMS = [
  { href: "/events", label: "Explore", icon: Compass, match: (p: string) => p.startsWith("/events") },
  { href: "/marketplace", label: "Resale", icon: Search, match: (p: string) => p.startsWith("/marketplace") },
  { href: "/tickets", label: "Tickets", icon: Ticket, match: (p: string) => p.startsWith("/tickets") },
  { href: "/balance", label: "Profile", icon: User, match: (p: string) => p.startsWith("/balance") },
];

const HIDDEN_PREFIXES = ["/admin", "/controller", "/login", "/signup", "/checkout", "/redeem"];
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
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-white/[0.08] bg-black/95 backdrop-blur-xl md:hidden"
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
              (active ? "text-[hsl(var(--accent))]" : "text-white/60")
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
