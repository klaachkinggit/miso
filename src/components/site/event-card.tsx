import Image from "next/image";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { eventImage } from "@/lib/events/images";
import type { EventRow } from "@/types/db";

export function EventCard({
  event,
  categoryCount,
  href,
}: {
  event: EventRow;
  categoryCount?: number;
  href?: string;
}) {
  const thumb = eventImage(event, "thumbnail");
  return (
    <Link
      href={href ?? `/events/${event.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={event.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,hsl(var(--ink))_0%,#2b2620_48%,hsl(var(--foreground))_120%)] p-6 text-center">
          <span className="max-w-[12rem] text-lg font-medium leading-tight text-[hsl(var(--foreground))]">{event.name}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-[hsl(var(--foreground))]/20 bg-[hsl(var(--ink))]/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--foreground))] backdrop-blur">
        {event.status === "published" ? "Open" : event.status}
      </span>

      <span className="absolute right-3 top-3 rounded bg-[hsl(var(--foreground))] px-2 py-1 font-mono text-[11px] font-medium uppercase text-[hsl(var(--ink))]">
        {formatDateShort(event.date)}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-xl font-medium leading-tight text-[hsl(var(--foreground))]">
          {event.name}
        </h3>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--foreground))]/80">
          {event.venue_name} · {event.city}
        </p>
        {typeof categoryCount === "number" ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[hsl(var(--foreground))]/70">
            <Ticket className="h-3 w-3" />
            {categoryCount} ticket tier{categoryCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
