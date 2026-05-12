import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { formatDate, formatPrice } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
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
    if (!event || event.status === "canceled") return false;
    if (new Date(event.date).getTime() < now) return false;
    if (!event.resale_enabled) return false;
    return true;
  });

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Resale tickets from other holders. Transfers run through the official Miso flow.
        </p>
      </div>
      {sellable.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sellable.map((listing) => {
            const ticket = ticketById.get(listing.ticket_id)!;
            const event = eventById.get(ticket.event_id)!;
            const category = categoryById.get(ticket.category_id);
            return (
              <Card key={listing.id} className="glass overflow-hidden rounded-lg">
                <Link href={`/marketplace/${listing.id}`} className="block">
                  <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
                    {event.image_url ? (
                      <Image
                        src={event.image_url}
                        alt={event.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(270_95%_70%/.3),transparent_35%),linear-gradient(135deg,hsl(240_10%_10%),hsl(220_40%_12%))]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                    <Badge className="absolute left-4 top-4" variant="secondary">
                      Resale
                    </Badge>
                  </div>
                </Link>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <Link href={`/marketplace/${listing.id}`} className="text-lg font-semibold hover:text-primary">
                      {event.name}
                    </Link>
                    <div className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(event.date)}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {event.venue_name}, {event.city}
                      </span>
                      {category ? (
                        <span className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          {category.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-semibold">
                      {formatPrice(listing.price, listing.currency)}
                    </div>
                    <Button asChild>
                      <Link href={`/marketplace/${listing.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No resale tickets right now"
          description="When holders list tickets for resale, they show up here."
        />
      )}
    </div>
  );
}
