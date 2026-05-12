import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, ShieldCheck, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatPrice, shortAddress } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, ResaleListing, Ticket, TicketCategory } from "@/types/db";
import { BuyListingButton } from "./buy-listing-button";

export const dynamic = "force-dynamic";

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServiceClient();
  const { data: listing } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle<ResaleListing>();
  if (!listing) notFound();

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", listing.ticket_id)
    .maybeSingle<Ticket>();
  if (!ticket) notFound();

  const [{ data: event }, { data: category }] = await Promise.all([
    sb.from("events").select("*").eq("id", ticket.event_id).maybeSingle<EventRow>(),
    sb
      .from("ticket_categories")
      .select("*")
      .eq("id", ticket.category_id)
      .maybeSingle<TicketCategory>(),
  ]);
  if (!event) notFound();

  const now = Date.now();
  const eventPast = new Date(event.date).getTime() < now;
  const eventCanceled = event.status === "canceled";
  const ticketInvalid = ticket.status !== "listed";
  const purchasable =
    listing.status === "active" &&
    !ticketInvalid &&
    !eventPast &&
    !eventCanceled &&
    event.resale_enabled;

  const reason = !purchasable
    ? listing.status !== "active"
      ? `Listing ${listing.status}`
      : ticketInvalid
      ? `Ticket ${ticket.status}`
      : eventCanceled
      ? "Event canceled"
      : eventPast
      ? "Event has passed"
      : !event.resale_enabled
      ? "Resale disabled"
      : null
    : null;

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-secondary">
          {event.image_url ? (
            <Image src={event.image_url} alt={event.name} fill priority sizes="100vw" className="object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <Badge className="absolute left-4 top-4" variant="secondary">
            Resale listing
          </Badge>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">{event.name}</h1>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
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

        <Card className="glass rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Official Miso transfer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Purchase routes through the Miso treasury. After payment, the NFT thaws, transfers
              to your wallet, and refreezes. The ticket cannot be transferred outside this flow.
            </p>
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Serial</p>
                <p className="font-mono text-foreground">#{ticket.serial_number}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">NFT</p>
                <p className="font-mono text-foreground">
                  {shortAddress(ticket.nft_asset_address)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="glass rounded-lg">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
              <p className="text-3xl font-semibold">{formatPrice(listing.price, listing.currency)}</p>
            </div>
            <BuyListingButton listingId={listing.id} disabled={!purchasable} reason={reason} />
            <Link href="/marketplace" className="block text-center text-xs text-muted-foreground hover:text-foreground">
              ← Back to marketplace
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
