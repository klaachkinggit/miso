import Image from "next/image";
import { Calendar, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  CancelListingButton,
  ListForResaleButton,
  TransferToWalletButton,
} from "@/components/tickets/list-for-resale-button";
import { formatDate, formatPrice } from "@/lib/format";
import { explorerUrl, shortAddress } from "@/lib/chain/utils";
import { eventImage } from "@/lib/events/images";
import { cn } from "@/lib/utils";
import type { EventRow, ResaleListing, Ticket, TicketCategory } from "@/types/db";

export function TicketCard({
  ticket,
  event,
  category,
  listing,
  canList,
  canExport,
  originalOnlineTotal,
  maxListPrice,
}: {
  ticket: Ticket;
  event: EventRow;
  category: TicketCategory | null;
  listing?: ResaleListing | null;
  canList?: boolean;
  canExport?: boolean;
  originalOnlineTotal?: number | null;
  maxListPrice?: number | null;
}) {
  const eventInPast = new Date(event.date).getTime() < Date.now();
  const eventCanceled = event.status === "canceled";
  const displayStatus: "valid" | "used" | "expired" | "refunded" | "refund_pending" | "canceled" | "listed" =
    ticket.status === "used"
      ? "used"
      : ticket.status === "refunded"
      ? "refunded"
      : ticket.status === "refund_pending"
      ? "refund_pending"
      : ticket.status === "canceled" || eventCanceled
      ? "canceled"
      : ticket.status === "expired" || (ticket.status === "sold" && eventInPast)
      ? "expired"
      : ticket.status === "listed"
      ? "listed"
      : "valid";
  const inactive = displayStatus !== "valid" && displayStatus !== "listed";
  const badgeVariant =
    displayStatus === "valid"
      ? "success"
      : displayStatus === "used"
      ? "warning"
      : displayStatus === "refund_pending"
      ? "warning"
      : displayStatus === "expired"
      ? "secondary"
      : displayStatus === "listed"
      ? "secondary"
      : "destructive";

  return (
    <Card className={cn("glass group relative overflow-hidden rounded-lg transition-transform hover:scale-[1.01]", inactive && "opacity-60 grayscale")}>
      <div className="relative aspect-[5/2] overflow-hidden bg-secondary">
        {(() => {
          const tv = ticket.image_url ?? eventImage(event, "ticket");
          return tv ? (
            <Image src={tv} alt={event.name} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
          ) : null;
        })()}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="ticket-foil pointer-events-none absolute inset-0 animate-shimmer opacity-60 mix-blend-screen" />
        <Badge className="absolute right-4 top-4" variant={badgeVariant}>
          {displayStatus}
        </Badge>
      </div>

      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="gradient-text text-xl font-semibold">{event.name}</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(event.date)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.venue_name}, {event.city}
            </span>
          </div>
        </div>
      </CardContent>

      <div className="absolute left-[-8px] top-[calc(50%+34px)] h-4 w-4 rounded-full border border-border/60 bg-background" />
      <div className="absolute right-[-8px] top-[calc(50%+34px)] h-4 w-4 rounded-full border border-border/60 bg-background" />

      <CardFooter className="grid gap-4 border-t border-dashed border-border/70 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Serial</p>
            <p className="font-mono">#{ticket.serial_number}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ticket tier</p>
            <Badge variant="secondary">{category?.name ?? "Ticket"}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Wallet</p>
            <p className="font-mono">{shortAddress(ticket.owner_evm_address)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Price</p>
            <p>{category ? formatPrice(originalOnlineTotal ?? category.price, category.currency) : "Paid"}</p>
          </div>
          {ticket.total_headcount ? (
            <div>
              <p className="text-muted-foreground">Headcount</p>
              <p>{ticket.total_headcount} guests</p>
            </div>
          ) : null}
          {ticket.min_spending_remaining != null && category ? (
            <div>
              <p className="text-muted-foreground">Venue balance</p>
              <p>{formatPrice(ticket.min_spending_remaining, category.currency)}</p>
            </div>
          ) : null}
        </div>
        {ticket.transferred_off_platform_at ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Transferred to personal wallet {shortAddress(ticket.transferred_to_address)}.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {ticket.nft_contract_address && ticket.mint_tx_hash ? (
            <Button asChild variant="outline">
              <a href={explorerUrl("tx", ticket.mint_tx_hash)} target="_blank" rel="noreferrer">
                Explorer <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {displayStatus === "listed" && listing ? (
            <CancelListingButton listingId={listing.id} />
          ) : null}
          {canList && displayStatus === "valid" && category ? (
            <ListForResaleButton
              ticketId={ticket.id}
              currency={category.currency}
              maxResalePrice={maxListPrice ?? originalOnlineTotal ?? category.max_resale_price}
              defaultPrice={maxListPrice ?? originalOnlineTotal ?? category.max_resale_price ?? category.price}
            />
          ) : null}
          {canExport && !ticket.transferred_off_platform_at ? (
            <TransferToWalletButton ticketId={ticket.id} />
          ) : null}
        </div>
        {displayStatus === "listed" && listing ? (
          <p className="text-xs text-muted-foreground">
            Listed for {formatPrice(listing.price, listing.currency)} ·{" "}
            <a href={`/marketplace/${listing.id}`} className="underline">
              view listing
            </a>
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
