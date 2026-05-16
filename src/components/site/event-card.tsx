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
      className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
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
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#121212_0%,#2b2620_48%,#E6D8C9_120%)] p-6 text-center">
          <span className="max-w-[12rem] text-lg font-medium leading-tight text-[#E6D8C9]">{event.name}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-[#E6D8C9]/20 bg-[#121212]/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[#E6D8C9] backdrop-blur">
        {event.status === "published" ? "Open" : event.status}
      </span>

      <span className="absolute right-3 top-3 rounded bg-[#E6D8C9] px-2 py-1 font-mono text-[11px] font-medium uppercase text-[#121212]">
        {formatDateShort(event.date)}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-xl font-medium leading-tight text-[#F5F3EE]">
          {event.name}
        </h3>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E6D8C9]/80">
          {event.venue_name} · {event.city}
        </p>
        {typeof categoryCount === "number" ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#E6D8C9]/70">
            <Ticket className="h-3 w-3" />
            {categoryCount} ticket tier{categoryCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
