import Image from "next/image";
import { Calendar, MapPin, ShieldCheck, Ticket, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BuyButton } from "@/components/site/buy-button";
import { WaitlistButton } from "@/components/site/waitlist-button";
import { eventImage } from "@/lib/events/images";
import type { PublicEventCategory } from "@/lib/events/public";
import { formatDate, formatDateShort, formatPrice } from "@/lib/format";
import type { EventRow } from "@/types/db";

export function EventDetail({
  event,
  categories,
  returnPath,
  calendarHref,
  isOnWaitlist,
  waitlistPath,
  organizationSlug,
  eventSlug,
}: {
  event: EventRow;
  categories: PublicEventCategory[];
  returnPath?: string;
  calendarHref?: string;
  isOnWaitlist?: boolean;
  waitlistPath?: string;
  organizationSlug?: string;
  eventSlug?: string;
}) {
  const cheapest = categories
    .filter((category) => category.remaining > 0 && category.sales_enabled)
    .sort((a, b) => Number(a.price) - Number(b.price))[0];
  const eventSoldOut =
    categories.length > 0 &&
    !categories.some(
      (category) => category.remaining > 0 && category.sales_enabled,
    );
  const showWaitlist =
    eventSoldOut &&
    Boolean(waitlistPath) &&
    Boolean(organizationSlug) &&
    Boolean(eventSlug);
  const hero = eventImage(event, "hero");

  return (
    <div className="pb-24 md:pb-12">
      <section className="relative min-h-[520px] overflow-hidden border-b border-hairline md:min-h-[640px]">
        <div className="absolute inset-0 bg-ink">
          {hero ? (
            <Image
              src={hero}
              alt={event.name}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-transparent to-transparent" />
        </div>
        <div className="container relative flex min-h-[520px] items-end pb-12 pt-28 md:min-h-[640px] md:pb-16">
          <div className="max-w-4xl">
            <span className="eyebrow-signal mb-5 inline-flex w-fit items-center gap-2.5">
              <span className="ticker-mark" aria-hidden />
              {formatDateShort(event.date)} · On sale
            </span>
            <h1 className="display text-5xl text-foreground md:text-7xl lg:text-[5.5rem]">
              {event.name}
            </h1>
            <div className="mt-8 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/80">
              <span className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(event.date)}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue_name} · {event.city}
              </span>
              <span className="flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5" />
                {event.capacity.toLocaleString()} capacity
              </span>
              {calendarHref ? (
                <a
                  href={calendarHref}
                  download
                  className="flex items-center gap-2 text-foreground/75 transition-colors hover:text-foreground"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Add to calendar
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <article>
            <p className="eyebrow">About this event</p>
            <h2 className="display mt-3 text-3xl text-foreground md:text-4xl">
              The story.
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>
                {event.description ||
                  "No event description has been added yet."}
              </p>
              {event.conditions ? (
                <div className="mt-6 border-t border-hairline pt-6">
                  <p className="eyebrow mb-2">Conditions</p>
                  <p>{event.conditions}</p>
                </div>
              ) : null}
            </div>
          </article>

          {event.floor_plan_url ? (
            <article>
              <p className="eyebrow">Floor plan</p>
              <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-ink-raised p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.floor_plan_url}
                  alt="Venue floor plan"
                  width={1200}
                  height={800}
                  loading="lazy"
                  className="w-full rounded object-contain"
                />
              </div>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Colors on the map match each Club Table tier.
              </p>
            </article>
          ) : null}

          <article className="rounded-md border border-hairline bg-card p-6">
            <p className="eyebrow-signal flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Entry verification
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              After checkout, your digital ticket appears in My tickets. At the
              gate, open the pass for QR verification; MISO keeps resale history
              tied to the ticket.
            </p>
          </article>
        </div>

        <aside
          id="tickets"
          className="space-y-4 lg:sticky lg:top-24 lg:self-start"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <p className="eyebrow">Tickets · tables</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {categories.length} tier{categories.length === 1 ? "" : "s"}
            </p>
          </div>
          {categories.length ? (
            <div className="space-y-3">
              {categories.map((category) => {
                const isClub = category.kind === "club_table";
                const soldOut = category.remaining <= 0;
                const now = Date.now();
                const comingSoon =
                  category.sale_starts_at != null &&
                  now < new Date(category.sale_starts_at).getTime();
                const salesEnded =
                  category.sale_ends_at != null &&
                  now > new Date(category.sale_ends_at).getTime();
                const disabled =
                  !category.sales_enabled ||
                  soldOut ||
                  comingSoon ||
                  salesEnded;
                const reason = comingSoon
                  ? `Coming soon · ${formatDateShort(category.sale_starts_at!)}`
                  : salesEnded
                    ? "Sales ended"
                    : !category.sales_enabled
                      ? "Sales closed"
                      : soldOut
                        ? "Sold out"
                        : null;

                const remainingBadge = soldOut ? (
                  <Badge variant="destructive">Not available</Badge>
                ) : category.public_sales_counter_enabled ? (
                  <Badge variant="signal">{category.remaining} left</Badge>
                ) : (
                  <Badge variant="success">Available</Badge>
                );

                return (
                  <div
                    key={category.id}
                    className="space-y-4 rounded-md border border-hairline bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        {isClub && category.color_hex ? (
                          <span
                            aria-hidden
                            className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-ink-raised"
                            style={{ backgroundColor: category.color_hex }}
                          />
                        ) : null}
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground">
                            {category.name}
                          </h3>
                          {category.description ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {category.description}
                            </p>
                          ) : null}
                          {isClub ? (
                            <div className="mt-2 space-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              <p>
                                Minimum:{" "}
                                <span className="text-foreground">
                                  {formatPrice(
                                    category.price,
                                    category.currency,
                                  )}
                                </span>
                              </p>
                              {category.base_capacity != null ? (
                                <p className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" /> Includes{" "}
                                  {category.base_capacity} guests
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {remainingBadge}
                    </div>
                    {category.benefits ? (
                      <p className="rounded-md border border-hairline bg-ink-soft/50 p-3 text-sm text-muted-foreground">
                        {category.benefits}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="display text-2xl text-foreground">
                          {isClub && category.online_advance != null
                            ? formatPrice(
                                category.online_advance,
                                category.currency,
                              )
                            : formatPrice(category.price, category.currency)}
                        </div>
                        {isClub ? (
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Online advance
                          </p>
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-hairline bg-card/70 p-6 text-sm text-muted-foreground">
              No ticket tiers are available.
            </div>
          )}
          {showWaitlist && waitlistPath && organizationSlug && eventSlug ? (
            <div className="rounded-md border border-hairline bg-card p-5">
              <p className="eyebrow mb-1">Sold out</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Join the waitlist and we&apos;ll email you the moment a ticket
                frees up.
              </p>
              <WaitlistButton
                organizationSlug={organizationSlug}
                eventSlug={eventSlug}
                path={waitlistPath}
                onWaitlist={Boolean(isOnWaitlist)}
              />
            </div>
          ) : null}
        </aside>
      </div>

      {cheapest ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-between gap-3 border-t border-hairline bg-background/95 px-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col">
            <span className="eyebrow text-muted-foreground">From</span>
            <span className="display text-lg text-foreground">
              {formatPrice(cheapest.price, cheapest.currency)}
            </span>
          </div>
          <a
            href="#tickets"
            className="inline-flex h-11 items-center rounded-md bg-signal px-6 text-sm font-medium text-accent-foreground"
          >
            Get ticket
          </a>
        </div>
      ) : null}
    </div>
  );
}
