import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Calendar, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateShort, formatPrice } from "@/lib/format";
import { getCurrentProfile } from "@/lib/auth";
import { getAccountBalanceAmount } from "@/lib/balances/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory } from "@/types/db";
import { BuyButton } from "./buy-button";

type Category = TicketCategory & { remaining: number };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single<EventRow>();
  if (!event) notFound();

  const { data: categories } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("event_id", event.id)
    .order("price", { ascending: true })
    .returns<TicketCategory[]>();

  const enriched: Category[] =
    categories?.map((category) => ({
      ...category,
      remaining: Math.max(0, category.supply - category.sold_count),
    })) ?? [];
  const balancesByCurrency = new Map<string, number>();
  if (profile) {
    await Promise.all(
      Array.from(new Set(enriched.map((category) => category.currency))).map(async (currency) => {
        balancesByCurrency.set(
          currency,
          await getAccountBalanceAmount({ profileId: profile.id, currency }),
        );
      }),
    );
  }

  const cheapest = enriched.filter((c) => c.remaining > 0).sort((a, b) => Number(a.price) - Number(b.price))[0];

  return (
    <div className="pb-24 md:pb-12">
      <section className="relative min-h-[520px] overflow-hidden md:min-h-[640px]">
        <div className="absolute inset-0 bg-black">
          {event.image_url ? (
            <Image src={event.image_url} alt={event.name} fill priority sizes="100vw" className="object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
        </div>
        <div className="container relative flex min-h-[520px] items-end pb-12 pt-28 md:min-h-[640px] md:pb-16">
          <div className="max-w-4xl">
            <span className="mono-stub mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-black">
              ● {formatDateShort(event.date)}
            </span>
            <h1 className="display text-5xl text-white md:text-7xl lg:text-8xl">{event.name}</h1>
            <div className="mono-stub mt-6 flex flex-wrap gap-4 text-white/70">
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
                {event.capacity.toLocaleString()} cap
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

          <Card className="glass rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Entry verification
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              After checkout, your ticket appears in My Tickets as an ERC-721 NFT held by your account. At the
              gate, open the ticket and tap your phone — the app verifies the on-chain holder, then marks the
              NFT redeemed. Screenshots and forwarded PDFs do not work.
            </CardContent>
          </Card>
        </div>

        <aside id="tickets" className="space-y-4">
          <h2 className="text-xl font-semibold">Tickets</h2>
          {enriched.length ? (
            enriched.map((category) => {
              const availableBalance = profile ? balancesByCurrency.get(category.currency) ?? 0 : null;
              const insufficientBalance =
                availableBalance !== null && availableBalance < Number(category.price);
              const disabled = !event.sales_enabled || category.remaining <= 0 || insufficientBalance;
              const reason = !event.sales_enabled
                ? "Sales closed"
                : category.remaining <= 0
                  ? "Sold out"
                  : insufficientBalance
                    ? `Balance ${formatPrice(availableBalance, category.currency)}`
                    : null;
              return (
                <Card key={category.id} className="glass rounded-lg">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{category.name}</h3>
                        {category.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                        ) : null}
                      </div>
                      <Badge variant={category.remaining > 0 ? "success" : "destructive"}>
                        {category.remaining > 0 ? `${category.remaining} left` : "Sold out"}
                      </Badge>
                    </div>
                    {category.benefits ? (
                      <p className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                        {category.benefits}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-2xl font-semibold">
                        {formatPrice(category.price, category.currency)}
                      </div>
                      <BuyButton categoryId={category.id} disabled={disabled} reason={reason} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="glass rounded-lg">
              <CardContent className="p-5 text-sm text-muted-foreground">No ticket categories are available.</CardContent>
            </Card>
          )}
        </aside>
      </div>

      {cheapest ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-between gap-3 border-t border-white/[0.08] bg-black/95 px-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col">
            <span className="mono-stub text-white/60">From</span>
            <span className="text-base font-bold">
              {formatPrice(cheapest.price, cheapest.currency)}
            </span>
          </div>
          <a
            href="#tickets"
            className="inline-flex h-11 items-center rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-bold text-black"
          >
            Get tickets
          </a>
        </div>
      ) : null}
    </div>
  );
}
