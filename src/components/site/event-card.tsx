import Image from "next/image";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { EventRow } from "@/types/db";

export function EventCard({
  event,
  categoryCount,
}: {
  event: EventRow;
  categoryCount?: number;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-white/[0.08] bg-black transition-all hover:border-[hsl(var(--accent))]/50"
    >
      {event.image_url ? (
        <Image
          src={event.image_url}
          alt={event.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 p-6 text-center">
          <span className="font-bold leading-tight text-white/40">{event.name}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
        {event.status === "published" ? "● Live" : event.status}
      </span>

      <span className="absolute right-3 top-3 rounded bg-[hsl(var(--accent))] px-2 py-1 font-mono text-[11px] font-bold uppercase text-black">
        {formatDateShort(event.date)}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-xl font-bold leading-tight text-white">
          {event.name}
        </h3>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/70">
          {event.venue_name} · {event.city}
        </p>
        {typeof categoryCount === "number" ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/60">
            <Ticket className="h-3 w-3" />
            {categoryCount} tier{categoryCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
