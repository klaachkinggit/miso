import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/empty-state";
import { eventImage } from "@/lib/events/images";
import { formatDate, formatPrice } from "@/lib/format";
import type { SellableResaleListing } from "@/lib/marketplace/public";

export function ResaleListingList({
  items,
  listingHref,
}: {
  items: SellableResaleListing[];
  listingHref: (item: SellableResaleListing) => string;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No tickets listed right now"
        description="When members list a ticket, it will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
      {items.map((item) => {
        const href = listingHref(item);
        return (
          <li
            key={item.listing.id}
            className="group flex flex-col gap-4 bg-ink-raised p-4 transition-colors hover:bg-ink-soft sm:flex-row sm:items-center sm:gap-5"
          >
            <Link
              href={href}
              className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-secondary sm:h-24 sm:w-32"
            >
              {(() => {
                const mp = eventImage(item.event, "marketplace");
                return mp ? (
                  <Image
                    src={mp}
                    alt={item.event.name}
                    fill
                    sizes="(min-width: 640px) 8rem, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--ink))_0%,hsl(var(--ink-soft))_52%,hsl(var(--signal))_180%)]" />
                );
              })()}
              <Badge className="absolute left-2 top-2" variant="secondary">
                Resale
              </Badge>
            </Link>

            <div className="min-w-0 flex-1 space-y-1.5">
              <Link
                href={href}
                className="line-clamp-1 text-base font-semibold transition-colors group-hover:text-primary"
              >
                {item.event.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.event.venue_name}, {item.event.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(item.event.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {item.category.name}
                </span>
              </div>
              {item.ticket.total_headcount ? (
                <p className="text-xs text-muted-foreground">As-is group pass: {item.ticket.total_headcount} guests</p>
              ) : null}
              {item.ticket.min_spending_remaining != null ? (
                <p className="text-xs text-muted-foreground">
                  Venue balance due: {formatPrice(item.ticket.min_spending_remaining, item.category.currency)}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
              <div className="text-right">
                <div className="text-lg font-semibold">{formatPrice(item.buyerTotal, item.listing.currency)}</div>
                {item.platformFee + item.stripeFee > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    incl. {formatPrice(item.platformFee + item.stripeFee, item.listing.currency)} fees
                  </p>
                ) : null}
              </div>
              <Button asChild size="sm">
                <Link href={href}>Buy</Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
