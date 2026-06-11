import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";
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
      className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-hairline bg-ink-raised transition-all duration-300 hover:-translate-y-1 hover:border-signal/40"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={event.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised p-6 text-center">
          <span className="display max-w-[14rem] text-2xl text-foreground">{event.name}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/85 to-transparent" />

      <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-hairline-strong bg-ink/85 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-foreground backdrop-blur">
        {event.status === "published" ? "On sale" : event.status}
      </span>

      <span className="absolute right-3 top-3 rounded bg-paper px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink">
        {formatDateShort(event.date)}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="display line-clamp-2 text-2xl text-foreground">
          {event.name}
        </h3>
        <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/75">
          {event.venue_name} · {event.city}
        </p>
        {typeof categoryCount === "number" ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-foreground/65">
            <Ticket className="h-3 w-3" />
            {categoryCount} tier{categoryCount === 1 ? "" : "s"}
          </p>
        ) : null}
        <ArrowUpRight
          aria-hidden
          className="absolute right-5 bottom-5 h-4 w-4 text-foreground/0 transition-all duration-300 group-hover:text-signal group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
