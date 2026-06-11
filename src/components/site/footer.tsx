import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type SitemapColumn = {
  title: string;
  entries: Array<{ label: string; href: string; external?: boolean }>;
};

const SITEMAP: SitemapColumn[] = [
  {
    title: "Product",
    entries: [
      { label: "Storefronts", href: "/#storefronts" },
      { label: "Payouts", href: "/#payouts" },
      { label: "Resale", href: "/#resale" },
      { label: "Door entry", href: "/#entry" },
      { label: "Analytics", href: "/#analytics" },
    ],
  },
  {
    title: "Organizers",
    entries: [
      { label: "Start free", href: "/signup/organizer" },
      { label: "Workspace", href: "/admin" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Fans",
    entries: [
      { label: "Explore events", href: "/events" },
      { label: "My tickets", href: "/tickets" },
      { label: "Buyer signup", href: "/signup/buyer" },
    ],
  },
  {
    title: "Company",
    entries: [
      { label: "Contact", href: "mailto:hello@miso.app" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-hairline bg-ink">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)] md:gap-10">
          <div className="space-y-5">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-foreground"
              aria-label="MISO home"
            >
              <span className="ticker-mark" aria-hidden />
              <span className="font-mono text-[15px] font-medium tracking-[0.18em]">MISO</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Ticketing infrastructure for venues, festivals, and cultural collectives. One workspace
              per organization — branded storefront, Stripe payouts, anti-scalping resale.
            </p>
            <p className="eyebrow">Built in Europe · Base Sepolia</p>
          </div>
          {SITEMAP.map((column) => (
            <div key={column.title}>
              <h4 className="eyebrow">{column.title}</h4>
              <ul className="mt-5 space-y-2.5 text-sm">
                {column.entries.map((entry) => (
                  <li key={entry.label}>
                    <Link
                      href={entry.href}
                      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {entry.label}
                      {entry.external ? (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-hairline pt-8 text-[12px] uppercase tracking-[0.18em] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} MISO — All rights reserved</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/cookies" className="hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
