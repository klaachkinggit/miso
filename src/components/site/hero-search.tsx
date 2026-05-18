"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

const QUICK_CHIPS = [
  { label: "Tonight", href: "/events?when=tonight" },
  { label: "Weekend", href: "/events?when=weekend" },
  { label: "Festivals", href: "/events" },
  { label: "Exchange", href: "/marketplace" },
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
        onSubmit={submit}
        role="search"
        className={`group relative flex items-center gap-2 rounded-full border border-[#E6D8C9]/15 bg-[#0b0b0b]/80 backdrop-blur-xl transition-colors focus-within:border-accent/60 ${padding}`}
      >
        <Search className="h-5 w-5 shrink-0 text-[#E6D8C9]/55" />
        <input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search an event, artist, organizer or city"
          className="min-w-0 flex-1 bg-transparent text-[#F5F3EE] placeholder:text-[#E6D8C9]/45 focus:outline-none"
          aria-label="Search events"
        />
        {size === "lg" ? (
          <button
            type="submit"
            className="hidden h-10 shrink-0 items-center rounded-full bg-[#F5F3EE] px-5 text-sm font-medium text-[#121212] transition-colors hover:bg-[#E6D8C9] sm:inline-flex"
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
              className="rounded-full border border-[#E6D8C9]/15 bg-[#121212]/70 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[#E6D8C9]/75 transition-colors hover:border-accent/50 hover:text-[#F5F3EE]"
            >
              {chip.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
