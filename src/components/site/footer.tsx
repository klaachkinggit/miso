import Link from "next/link";
import { Globe } from "lucide-react";

const COLUMNS = [
  {
    title: "Discover",
    links: [
      { label: "All events", href: "/events" },
      { label: "Tonight", href: "/events?when=tonight" },
      { label: "This weekend", href: "/events?when=weekend" },
      { label: "Resale exchange", href: "/marketplace" },
    ],
  },
  {
    title: "Cities",
    links: [
      { label: "Paris", href: "/events?city=paris" },
      { label: "Berlin", href: "/events?city=berlin" },
      { label: "London", href: "/events?city=london" },
      { label: "Amsterdam", href: "/events?city=amsterdam" },
    ],
  },
  {
    title: "Organizers",
    links: [
      { label: "Publish an event", href: "/signup" },
      { label: "Smart pricing", href: "/signup" },
      { label: "Audience tools", href: "/signup" },
      { label: "Pro dashboard", href: "/admin" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Wallet", href: "/tickets" },
      { label: "My tickets", href: "/tickets" },
      { label: "Log in", href: "/login" },
      { label: "Sign up", href: "/signup" },
    ],
  },
];

const SOCIALS = ["Instagram", "TikTok", "X", "YouTube", "SoundCloud"];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-[#0b0b0b] text-[#E6D8C9]/80">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
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
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h4 className="mono-stub text-[#E6D8C9]/55">{column.title}</h4>
              <ul className="mt-4 space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[#E6D8C9]/80 transition-colors hover:text-[#F5F3EE]"
                    >
                      {link.label}
                    </Link>
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
            <Link href="/" className="hover:text-[#F5F3EE]">Terms</Link>
            <Link href="/" className="hover:text-[#F5F3EE]">Privacy</Link>
            <Link href="/" className="hover:text-[#F5F3EE]">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
