import Image from "next/image";
import { Calendar, MapPin, ShieldCheck, Ticket, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BuyButton } from "@/components/site/buy-button";
import { eventImage } from "@/lib/events/images";
import type { PublicEventCategory } from "@/lib/events/public";
import { formatDate, formatDateShort, formatPrice } from "@/lib/format";
import type { EventRow } from "@/types/db";

export function EventDetail({
  event,
  categories,
  returnPath,
}: {
  event: EventRow;
  categories: PublicEventCategory[];
  returnPath?: string;
}) {
  const cheapest = categories
    .filter((category) => category.remaining > 0 && category.sales_enabled)
    .sort((a, b) => Number(a.price) - Number(b.price))[0];

  return (
    <div className="pb-24 md:pb-12">
      <section className="relative min-h-[520px] overflow-hidden md:min-h-[640px]">
        <div className="absolute inset-0 bg-black">
          {(() => {
            const hero = eventImage(event, "hero");
            return hero ? (
              <Image src={hero} alt={event.name} fill priority sizes="100vw" className="object-cover" />
            ) : null;
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
        </div>
        <div className="container relative flex min-h-[520px] items-end pb-12 pt-28 md:min-h-[640px] md:pb-16">
          <div className="max-w-4xl">
            <span className="mono-stub mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#E6D8C9] px-3 py-1 text-[#121212]">
              {formatDateShort(event.date)}
            </span>
            <h1 className="display text-5xl text-[#F5F3EE] md:text-7xl lg:text-8xl">{event.name}</h1>
            <div className="mono-stub mt-6 flex flex-wrap gap-4 text-[#E6D8C9]/80">
              <span className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(event.date)}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue_name}, {event.city}
              </span>
              <span className="flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5" />
                {event.capacity.toLocaleString()} capacity
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Card className="glass rounded-lg">
            <CardHeader>
              <CardTitle>About this event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{event.description || "No event description has been added yet."}</p>
              {event.conditions ? (
                <>
                  <Separator />
                  <div>
                    <h2 className="mb-2 font-medium text-foreground">Conditions</h2>
                    <p>{event.conditions}</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {event.floor_plan_url ? (
            <Card className="glass rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Floor plan</CardTitle>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.floor_plan_url}
                  alt="Venue floor plan"
                  className="w-full rounded-md border border-border/60 object-contain"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Colors on the map match the color vignette of each Club Table tier.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="glass rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Entry verification
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              After checkout, your digital ticket appears in Wallet. At the gate, open the pass for QR
              verification while MISO keeps ownership and resale history tied to the ticket.
            </CardContent>
          </Card>
        </div>

        <aside id="tickets" className="space-y-4">
          <h2 className="text-xl font-medium">Tickets &amp; tables</h2>
          {categories.length ? (
            categories.map((category) => {
              const isClub = category.kind === "club_table";
              const soldOut = category.remaining <= 0;
              const disabled = !category.sales_enabled || soldOut;
              const reason = !category.sales_enabled
                ? "Sales closed"
                : soldOut
                  ? "Sold out"
                  : null;

              const remainingBadge = soldOut ? (
                <Badge variant="destructive">Not available</Badge>
              ) : category.public_sales_counter_enabled ? (
                <Badge variant="success">{category.remaining} left</Badge>
              ) : (
                <Badge variant="success">Available</Badge>
              );

              return (
                <Card key={category.id} className="glass rounded-lg">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {isClub && category.color_hex ? (
                          <span
                            aria-hidden
                            className="mt-1 inline-block h-4 w-4 shrink-0 rounded-full ring-2 ring-background"
                            style={{ backgroundColor: category.color_hex }}
                          />
                        ) : null}
                        <div>
                          <h3 className="font-semibold">{category.name}</h3>
                          {category.description ? (
                            <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                          ) : null}
                          {isClub ? (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>
                                Minimum spending:{" "}
                                <span className="font-medium text-foreground">
                                  {formatPrice(category.price, category.currency)}
                                </span>
                              </p>
                              {category.base_capacity != null ? (
                                <p className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" /> Includes {category.base_capacity} guests
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {remainingBadge}
                    </div>
                    {category.benefits ? (
                      <p className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                        {category.benefits}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-2xl font-semibold">
                          {isClub && category.online_advance != null
                            ? formatPrice(category.online_advance, category.currency)
                            : formatPrice(category.price, category.currency)}
                        </div>
                        {isClub ? (
                          <p className="text-xs text-muted-foreground">Online advance</p>
                        ) : null}
                      </div>
                      <BuyButton
                        category={{
                          id: category.id,
                          kind: category.kind,
                          currency: category.currency,
                          price: category.price,
                          online_advance: category.online_advance,
                          extra_guests_enabled: category.extra_guests_enabled,
                          price_per_extra_guest: category.price_per_extra_guest,
                          max_extra_guests: category.max_extra_guests,
                          base_capacity: category.base_capacity,
                        }}
                        disabled={disabled}
                        reason={reason}
                        returnPath={returnPath}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="glass rounded-lg">
              <CardContent className="p-5 text-sm text-muted-foreground">No ticket tiers are available.</CardContent>
            </Card>
          )}
        </aside>
      </div>

      {cheapest ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-between gap-3 border-t border-border bg-background/95 px-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col">
            <span className="mono-stub text-muted-foreground">From</span>
            <span className="text-base font-bold">{formatPrice(cheapest.price, cheapest.currency)}</span>
          </div>
          <a
            href="#tickets"
            className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground"
          >
            Get ticket
          </a>
        </div>
      ) : null}
    </div>
  );
}
