import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";

type SitemapEntry =
  | { kind: "link"; label: string; href: string }
  | { kind: "unwrap"; label: string; body: string };

type SitemapColumn = {
  title: string;
  entries: SitemapEntry[];
};

const SITEMAP: SitemapColumn[] = [
  {
    title: "Fans",
    entries: [
      { kind: "link", label: "My wallet", href: "/tickets" },
      {
        kind: "unwrap",
        label: "How tickets work",
        body: "Buy a ticket and a unique NFT is minted to your MISO wallet. Show the in-app QR at the door — the bouncer scans it once and it burns. No screenshots, no duplicates.",
      },
      {
        kind: "unwrap",
        label: "Verified tickets",
        body: "Every ticket is a Base ERC-721 token signed by the event organizer. You can prove ownership on-chain at any time. Lost phone? Recover your wallet and your ticket comes back with you.",
      },
      {
        kind: "unwrap",
        label: "Anti-scalping",
        body: "Resale is capped at the price set by the organizer. Bots are blocked at checkout. Listings above the cap are rejected, so you never pay scalper markups.",
      },
      {
        kind: "unwrap",
        label: "Resale rules",
        body: "List unused tickets on the official exchange. Sellers get instant payout once the buyer pays. Buyers are protected: if a sold ticket fails to transfer on-chain, the purchase is refunded automatically.",
      },
    ],
  },
  {
    title: "Organizers",
    entries: [
      { kind: "link", label: "Publish an event", href: "/signup/organizer" },
      {
        kind: "unwrap",
        label: "Pricing & fees",
        body: "MISO takes a flat 4% service fee on primary sales and 6% on resale, paid by the buyer. Stripe processing is passed through at cost. No subscription, no listing fee.",
      },
    ],
  },
  {
    title: "Company",
    entries: [
      {
        kind: "unwrap",
        label: "About MISO",
        body: "MISO is on-chain ticketing for nightlife, festivals, and live music. We replace screenshots and shady resale with verifiable NFT tickets on Base, so fans get in and organizers keep control.",
      },
      { kind: "link", label: "Contact", href: "mailto:hello@miso.app" },
      { kind: "link", label: "Terms", href: "/legal/terms" },
      { kind: "link", label: "Privacy", href: "/legal/privacy" },
    ],
  },
];

const SOCIALS = ["Instagram", "TikTok", "X", "YouTube", "SoundCloud"];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-[#0b0b0b] text-[#E6D8C9]/80">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-[#F5F3EE]">
              <span className="text-accent">●</span> MISO
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-[#E6D8C9]/65">
              Premium NFT ticketing for festivals, concerts, nightlife, and exclusive experiences. Live it, own it, resell it.
            </p>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[#E6D8C9]/55">
              <Globe className="h-4 w-4" /> EN · FR · DE
            </div>
          </div>
          {SITEMAP.map((column) => (
            <div key={column.title}>
              <h4 className="mono-stub text-[#E6D8C9]/55">{column.title}</h4>
              <ul className="mt-4 space-y-2 text-sm">
                {column.entries.map((entry) => (
                  <li key={entry.label}>
                    {entry.kind === "link" ? (
                      <Link
                        href={entry.href}
                        className="text-[#E6D8C9]/80 transition-colors hover:text-[#F5F3EE]"
                      >
                        {entry.label}
                      </Link>
                    ) : (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[#E6D8C9]/80 transition-colors hover:text-[#F5F3EE]">
                          {entry.label}
                          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-2 text-xs leading-relaxed text-[#E6D8C9]/60">
                          {entry.body}
                        </p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-border/60 pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.24em] text-[#E6D8C9]/55">
            {SOCIALS.map((social) => (
              <span key={social}>{social}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.24em] text-[#E6D8C9]/45">
            <span>© {new Date().getFullYear()} MISO</span>
            <Link href="/legal/terms" className="hover:text-[#F5F3EE]">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-[#F5F3EE]">Privacy</Link>
            <Link href="/legal/cookies" className="hover:text-[#F5F3EE]">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
