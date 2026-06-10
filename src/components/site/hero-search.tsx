"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

const QUICK_CHIPS = [
  { label: "Tonight", href: "/events?when=tonight" },
  { label: "Weekend", href: "/events?when=weekend" },
  { label: "Festivals", href: "/events" },
];

export function HeroSearch({ size = "lg" }: { size?: "lg" | "md" }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/events?q=${encodeURIComponent(q)}` : "/events");
  };

  const padding = size === "lg" ? "h-14 md:h-16 px-5 md:px-6 text-base" : "h-11 px-4 text-sm";

  return (
    <div className="w-full">
      <form
        action="/events"
        method="get"
        onSubmit={submit}
        role="search"
        className={`group relative flex items-center gap-2 rounded-full border border-[hsl(var(--foreground))]/15 bg-[#0b0b0b]/80 backdrop-blur-xl transition-colors focus-within:border-accent/60 ${padding}`}
      >
        <Search className="h-5 w-5 shrink-0 text-[hsl(var(--foreground))]/55" />
        <input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search an event, artist, organizer or city"
          className="min-w-0 flex-1 bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--foreground))]/45 focus:outline-none"
          aria-label="Search events"
        />
        {size === "lg" ? (
          <button
            type="submit"
            className="hidden h-10 shrink-0 items-center rounded-full bg-[hsl(var(--foreground))] px-5 text-sm font-medium text-[hsl(var(--ink))] transition-colors hover:bg-[hsl(var(--foreground))] sm:inline-flex"
          >
            Explore
          </button>
        ) : (
          <button type="submit" className="sr-only">Search</button>
        )}
      </form>
      {size === "lg" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <a
              key={chip.label}
              href={chip.href}
              className="rounded-full border border-[hsl(var(--foreground))]/15 bg-[hsl(var(--ink))]/70 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[hsl(var(--foreground))]/75 transition-colors hover:border-accent/50 hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {chip.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
