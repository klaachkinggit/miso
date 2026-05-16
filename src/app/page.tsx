import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowUpRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDateShort } from "@/lib/format";
import type { EventRow } from "@/types/db";

export default async function HomePage() {
  const sb = createServiceClient();
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");

  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true })
    .limit(6)
    .returns<EventRow[]>();

  const featured = events?.[0];
  const grid = events?.slice(1) ?? [];

  return (
    <div className="pb-20 md:pb-12">
      <section className="relative">
        {featured ? (
          <Link
            href={`/events/${featured.id}`}
            className="group relative block h-[70vh] min-h-[480px] w-full overflow-hidden md:h-[80vh]"
          >
            {featured.image_url ? (
              <Image
                src={featured.image_url}
                alt={featured.name}
                fill
                priority
                sizes="100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

            <div className="container relative flex h-full flex-col justify-end pb-12 md:pb-16">
              <span className="mono-stub mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-black">
                ● FEATURED · {formatDateShort(featured.date)}
              </span>
              <h1 className="display max-w-4xl text-5xl text-white md:text-7xl lg:text-8xl">
                {featured.name}
              </h1>
              <p className="mono-stub mt-4 text-white/70">
                {featured.venue_name} · {featured.city}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex h-11 items-center gap-2 rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-bold text-black transition-colors group-hover:bg-[hsl(72_100%_60%)]">
                  Get tickets <ArrowUpRight className="h-4 w-4" />
                </span>
                <span className="mono-stub text-white/60">
                  Tap-to-enter · No QR · No screenshot
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="container py-20">
            <h1 className="display text-5xl md:text-7xl">Tickets that prove themselves.</h1>
            <p className="mt-4 max-w-xl text-white/70">
              On-chain ERC-721 tickets on Base. Tap your phone at the gate — copies and screenshots do not work.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link href="/events">Browse events</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="container py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="display text-3xl md:text-5xl">Upcoming</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">All events →</Link>
          </Button>
        </div>
        {grid.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grid.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No more events scheduled"
            description="Organizers will publish more events soon."
          />
        )}
      </section>

      <section className="container pb-16">
        <div className="grid gap-px overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.06] md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "On-chain proof",
              body: "Every ticket is an ERC-721 NFT on Base. Provenance is public, ownership is yours.",
            },
            {
              icon: Zap,
              title: "Tap to enter",
              body: "Open your ticket at the gate. The app verifies your NFT on the spot. No QR, no PDF, no screenshot.",
            },
            {
              icon: ArrowUpRight,
              title: "Safe resale",
              body: "List your ticket inside the app. Transfer happens on-chain after the buyer pays.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-black p-6">
              <Icon className="h-5 w-5 text-[hsl(var(--accent))]" />
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-white/60">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
