import Image from "next/image";
import Link from "next/link";
import { Calendar, Circle, MapPin, ShieldCheck, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BuyListingButton } from "@/components/site/buy-listing-button";
import { shortAddress } from "@/lib/chain/utils";
import { eventImage } from "@/lib/events/images";
import { formatDate, formatPrice } from "@/lib/format";
import type { SellableResaleListing } from "@/lib/marketplace/public";

export function ResaleListingDetail({
  item,
  backHref,
  returnPath,
}: {
  item: SellableResaleListing;
  backHref: string;
  returnPath?: string;
}) {
  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-secondary">
          {(() => {
            const mp = eventImage(item.event, "marketplace");
            return mp ? (
              <Image src={mp} alt={item.event.name} fill priority sizes="100vw" className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(145deg,#121212_0%,#2b2620_52%,#E6D8C9_130%)]" />
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <Badge className="absolute left-4 top-4" variant="secondary">
            Resale ticket
          </Badge>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">{item.event.name}</h1>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(item.event.date)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {item.event.venue_name}, {item.event.city}
            </span>
            <span className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {item.category.name}
            </span>
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
            {item.category.kind === "club_table" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Headcount</p>
                    <p className="flex items-center gap-2 text-foreground">
                      <Users className="h-4 w-4" />
                      {item.ticket.total_headcount ?? item.category.base_capacity ?? 1} guests
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Extra guests</p>
                    <p className="text-foreground">{item.ticket.extra_guests_count} added</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining due at venue</p>
                    <p className="text-foreground">
                      {item.ticket.min_spending_remaining != null
                        ? formatPrice(item.ticket.min_spending_remaining, item.category.currency)
                        : "Ask venue"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Table color</p>
                    <p className="flex items-center gap-2 text-foreground">
                      <Circle
                        className="h-4 w-4"
                        fill={item.ticket.color_hex_snapshot ?? item.category.color_hex ?? "currentColor"}
                        color={item.ticket.color_hex_snapshot ?? item.category.color_hex ?? "currentColor"}
                      />
                      {item.ticket.color_hex_snapshot ?? item.category.color_hex ?? "No color"}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Serial</p>
                <p className="font-mono text-foreground">#{item.ticket.serial_number}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Token</p>
                <p className="font-mono text-foreground">
                  {shortAddress(item.ticket.nft_contract_address)}#{item.ticket.nft_token_id ?? "?"}
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
              <p className="text-3xl font-semibold">{formatPrice(item.buyerTotal, item.listing.currency)}</p>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>Seller price</span>
                  <span>{formatPrice(item.listing.price, item.listing.currency)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>MISO platform fee</span>
                  <span>{formatPrice(item.platformFee, item.listing.currency)}</span>
                </div>
                {item.royaltyAmount > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span>Organizer royalty</span>
                    <span>{formatPrice(item.royaltyAmount, item.listing.currency)}</span>
                  </div>
                ) : null}
              </div>
              {item.ticket.min_spending_remaining != null ? (
                <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  As-is resale: you inherit the table headcount and the remaining minimum
                  spending balance due at the venue ({formatPrice(item.ticket.min_spending_remaining, item.category.currency)}).
                </p>
              ) : null}
            </div>
            <BuyListingButton listingId={item.listing.id} returnPath={returnPath} />
            <Link href={backHref} className="block text-center text-xs text-muted-foreground hover:text-foreground">
              Back to exchange
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
