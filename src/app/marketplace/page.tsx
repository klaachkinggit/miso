import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { formatDate, formatPrice } from "@/lib/format";
import { resalePlatformFee } from "@/lib/resale/pricing";
import { createServiceClient } from "@/lib/supabase/service";
import { eventImage } from "@/lib/events/images";
import type { EventRow, ResaleListing, Ticket, TicketCategory } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const sb = createServiceClient();
  const { data: listings } = await sb
    .from("resale_listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<ResaleListing[]>();

  const ticketIds = [...new Set((listings ?? []).map((l) => l.ticket_id))];
  const { data: tickets } = ticketIds.length
    ? await sb.from("tickets").select("*").in("id", ticketIds).returns<Ticket[]>()
    : { data: [] as Ticket[] };

  const eventIds = [...new Set((tickets ?? []).map((t) => t.event_id))];
  const categoryIds = [...new Set((tickets ?? []).map((t) => t.category_id))];

  const [{ data: events }, { data: categories }] = await Promise.all([
    eventIds.length
      ? sb.from("events").select("*").in("id", eventIds).returns<EventRow[]>()
      : Promise.resolve({ data: [] as EventRow[] }),
    categoryIds.length
      ? sb.from("ticket_categories").select("*").in("id", categoryIds).returns<TicketCategory[]>()
      : Promise.resolve({ data: [] as TicketCategory[] }),
  ]);

  const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const now = Date.now();
  const sellable = (listings ?? []).filter((listing) => {
    const ticket = ticketById.get(listing.ticket_id);
    if (!ticket || ticket.status !== "listed") return false;
    const event = eventById.get(ticket.event_id);
    if (!event || event.status !== "published") return false;
    if (new Date(event.date).getTime() < now) return false;
    const category = categoryById.get(ticket.category_id);
    if (!category?.resale_enabled) return false;
    return true;
  });

  return (
    <div className="container py-10">
      <PageHeader
        title="Resale exchange"
        description="Verified NFT tickets listed by members through the official MISO anti-scalping marketplace."
        className="mb-8"
      />
      {sellable.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {sellable.map((listing) => {
            const ticket = ticketById.get(listing.ticket_id)!;
            const event = eventById.get(ticket.event_id)!;
            const category = categoryById.get(ticket.category_id);
            const platformFee = resalePlatformFee(Number(listing.price));
            const buyerTotal = Number(listing.price) + platformFee;
            return (
              <li
                key={listing.id}
                className="group flex flex-col gap-4 bg-[#0d0d0d] p-4 transition-colors hover:bg-[#121212] sm:flex-row sm:items-center sm:gap-5"
              >
                <Link
                  href={`/marketplace/${listing.id}`}
                  className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-secondary sm:h-24 sm:w-32"
                >
                  {(() => {
                    const mp = eventImage(event, "marketplace");
                    return mp ? (
                      <Image
                        src={mp}
                        alt={event.name}
                        fill
                        sizes="(min-width: 640px) 8rem, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[linear-gradient(145deg,#121212_0%,#2b2620_52%,#E6D8C9_130%)]" />
                    );
                  })()}
                  <Badge className="absolute left-2 top-2" variant="secondary">
                    Resale
                  </Badge>
                </Link>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="line-clamp-1 text-base font-semibold transition-colors group-hover:text-primary"
                  >
                    {event.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.venue_name}, {event.city}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.date)}
                    </span>
                    {category ? (
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        {category.name}
                      </span>
                    ) : null}
                  </div>
                  {ticket.total_headcount ? (
                    <p className="text-xs text-muted-foreground">As-is group pass: {ticket.total_headcount} guests</p>
                  ) : null}
                  {ticket.min_spending_remaining != null && category ? (
                    <p className="text-xs text-muted-foreground">
                      Venue balance due: {formatPrice(ticket.min_spending_remaining, category.currency)}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatPrice(buyerTotal, listing.currency)}</div>
                    {platformFee > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        incl. {formatPrice(platformFee, listing.currency)} fee
                      </p>
                    ) : null}
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/marketplace/${listing.id}`}>Buy</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No tickets listed right now"
          description="When members list a ticket, it will appear here."
        />
      )}
    </div>
  );
}
