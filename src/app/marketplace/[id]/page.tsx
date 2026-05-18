import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Circle, MapPin, ShieldCheck, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatPrice } from "@/lib/format";
import { shortAddress } from "@/lib/chain/utils";
import { resalePlatformFee } from "@/lib/resale/pricing";
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
  if (!event || !category) notFound();

  const now = Date.now();
  const eventPast = new Date(event.date).getTime() < now;
  const ticketInvalid = ticket.status !== "listed";
  if (
    listing.status !== "active" ||
    ticketInvalid ||
    event.status !== "published" ||
    eventPast ||
    !category.resale_enabled
  ) {
    notFound();
  }
  const platformFee = resalePlatformFee(Number(listing.price));
  const buyerTotal = Number(listing.price) + platformFee;

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-secondary">
          {event.image_url ? (
            <Image src={event.image_url} alt={event.name} fill priority sizes="100vw" className="object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#121212_0%,#2b2620_52%,#E6D8C9_130%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <Badge className="absolute left-4 top-4" variant="secondary">
            Resale ticket
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
              Official MISO exchange
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Purchase settles via Stripe. MISO handles the NFT ticket transfer after
              payment, keeping resale inside the official anti-scalping flow.
            </p>
            <Separator />
            {category?.kind === "club_table" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Headcount</p>
                    <p className="flex items-center gap-2 text-foreground">
                      <Users className="h-4 w-4" />
                      {ticket.total_headcount ?? category.base_capacity ?? 1} guests
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Extra guests</p>
                    <p className="text-foreground">{ticket.extra_guests_count} added</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining due at venue</p>
                    <p className="text-foreground">
                      {ticket.min_spending_remaining != null
                        ? formatPrice(ticket.min_spending_remaining, category.currency)
                        : "Ask venue"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Table color</p>
                    <p className="flex items-center gap-2 text-foreground">
                      <Circle
                        className="h-4 w-4"
                        fill={ticket.color_hex_snapshot ?? category.color_hex ?? "currentColor"}
                        color={ticket.color_hex_snapshot ?? category.color_hex ?? "currentColor"}
                      />
                      {ticket.color_hex_snapshot ?? category.color_hex ?? "No color"}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Serial</p>
                <p className="font-mono text-foreground">#{ticket.serial_number}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Token</p>
                <p className="font-mono text-foreground">
                  {shortAddress(ticket.nft_contract_address)}#{ticket.nft_token_id ?? "?"}
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">You pay today</p>
              <p className="text-3xl font-semibold">{formatPrice(buyerTotal, listing.currency)}</p>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>Seller price</span>
                  <span>{formatPrice(listing.price, listing.currency)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>MISO platform fee</span>
                  <span>{formatPrice(platformFee, listing.currency)}</span>
                </div>
              </div>
              {ticket.min_spending_remaining != null && category ? (
                <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  As-is resale: you inherit the table headcount and the remaining minimum
                  spending balance due at the venue ({formatPrice(ticket.min_spending_remaining, category.currency)}).
                </p>
              ) : null}
            </div>
            <BuyListingButton listingId={listing.id} />
            <Link href="/marketplace" className="block text-center text-xs text-muted-foreground hover:text-foreground">
              Back to exchange
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
