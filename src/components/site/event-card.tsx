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
      className="storefront-event-card group"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={event.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
          className="storefront-event-card-image object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised p-6 text-center">
          <span className="display max-w-[14rem] text-2xl text-foreground">
            {event.name}
          </span>
        </div>
      )}

      <div className="storefront-event-card-shade" />

      <span className="storefront-event-card-status">
        {event.status === "published" ? "On sale" : event.status}
      </span>

      <span className="storefront-event-card-date">
        {formatDateShort(event.date)}
      </span>

      <div className="storefront-event-card-body">
        <h3 className="storefront-event-card-title display line-clamp-2 text-foreground">
          {event.name}
        </h3>
        <p className="storefront-event-card-meta">
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
          className="absolute right-5 bottom-5 h-4 w-4 text-foreground/0 transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal"
        />
      </div>
    </Link>
  );
}
