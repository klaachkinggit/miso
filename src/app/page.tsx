import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Compass,
  Gem,
  Megaphone,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { HeroSearch } from "@/components/site/hero-search";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDateShort } from "@/lib/format";
import { eventImage } from "@/lib/events/images";
import { loadSiteSettings } from "@/lib/site/settings";
import type { EventRow } from "@/types/db";

const FALLBACK_CITIES = ["Paris", "Berlin", "London", "Amsterdam", "Lisbon", "Barcelona", "Brussels", "Milan"];

export default async function HomePage() {
  const sb = createServiceClient();
  const [profile, siteSettings] = await Promise.all([getCurrentProfile(), loadSiteSettings()]);
  if (profile?.role === "controller") redirect("/controller");

  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true })
    .limit(9)
    .returns<EventRow[]>();

  const featured = events?.[0];
  const grid = events?.slice(1, 9) ?? [];
  const cities = Array.from(
    new Set([...(events?.map((e) => e.city).filter(Boolean) ?? []), ...FALLBACK_CITIES]),
  ).slice(0, 8);

  return (
    <div className="pb-20 md:pb-0">
      {/* HERO ------------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden border-b border-border">
        {siteSettings?.landing_hero_bg_url ? (
          <Image
            src={siteSettings.landing_hero_bg_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover opacity-55 saturate-[0.85]"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-95"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(184,155,94,0.32), transparent 38rem)," +
              "radial-gradient(circle at 85% 30%, rgba(230,216,201,0.18), transparent 32rem)," +
              "linear-gradient(180deg,#101010 0%, #0a0a0a 60%, #111111 100%)",
          }}
        />
        <div className="container grid items-center gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          <div className="space-y-7">
            <span className="mono-stub inline-flex items-center gap-2 rounded-full border border-[#E6D8C9]/20 bg-[#121212]/70 px-3 py-1 text-[#E6D8C9]/80">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> NFT ticketing · Base Sepolia
            </span>
            <h1 className="display max-w-2xl text-5xl text-[#F5F3EE] md:text-7xl lg:text-[5.5rem]">
              Get your ticket.<br />
              <span className="gradient-text">Live the night.</span>
            </h1>
            <p className="max-w-xl text-lg text-[#E6D8C9]/75 md:text-xl">
              Discover festivals, concerts and after-hours culture. Every MISO ticket is on-chain, verified at the door,
              and resellable inside a safe official exchange.
            </p>
            <HeroSearch />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-sm text-[#E6D8C9]/70">
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
                <span className="ml-1 font-medium text-[#F5F3EE]">4.9</span>
                <span>· 12k reviews</span>
              </div>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span>200+ venues onboarded</span>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span>Anti-scalping enforced</span>
            </div>
          </div>

          {/* Hero visual: featured event card if exists, else mockup tile */}
          <div className="relative hidden md:block">
            <div className="absolute -left-10 -top-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-12 -right-6 h-72 w-72 rounded-full bg-[#E6D8C9]/10 blur-3xl" aria-hidden />
            {featured ? (
              <Link
                href={`/events/${featured.id}`}
                className="group relative block aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl border border-[#E6D8C9]/15 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.9)]"
              >
                {(() => {
                  const hero = eventImage(featured, "hero") ?? eventImage(featured, "thumbnail");
                  return hero ? (
                    <Image
                      src={hero}
                      alt={featured.name}
                      fill
                      priority
                      sizes="(min-width: 768px) 40vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(145deg,#121212,#2b2620_55%,#E6D8C9)]" />
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute inset-x-5 top-5 flex flex-wrap items-center justify-between gap-2">
                  <span className="mono-stub rounded-full bg-[#E6D8C9] px-3 py-1 text-[#121212]">
                    Featured · {formatDateShort(featured.date)}
                  </span>
                  <span className="mono-stub rounded-full bg-black/60 px-3 py-1 text-[#E6D8C9] backdrop-blur">
                    Live
                  </span>
                </div>
                <div className="absolute inset-x-5 bottom-5 flex flex-col gap-3">
                  <div className="space-y-1.5">
                    <h2 className="display line-clamp-2 text-2xl leading-tight text-[#F5F3EE] lg:text-3xl">
                      {featured.name}
                    </h2>
                    <p className="mono-stub line-clamp-1 text-[#E6D8C9]/80">
                      {featured.venue_name} · {featured.city}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F5F3EE] px-4 py-1.5 text-sm font-medium text-[#121212] transition-colors group-hover:bg-accent">
                    Get ticket <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="relative aspect-[4/5] w-full max-w-md rounded-3xl border border-[#E6D8C9]/15 bg-[linear-gradient(145deg,#121212,#2b2620_55%,#E6D8C9)] p-8">
                <div className="space-y-4 text-[#F5F3EE]">
                  <span className="mono-stub rounded-full bg-black/40 px-3 py-1">Live drop</span>
                  <h2 className="display text-3xl">Your ticket is your access pass.</h2>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CITIES STRIP --------------------------------------------------- */}
      <section className="border-b border-border bg-[#0d0d0d]">
        <div className="container flex items-center gap-3 overflow-x-auto py-4 [&::-webkit-scrollbar]:hidden">
          <span className="mono-stub shrink-0 text-[#E6D8C9]/55">Popular cities</span>
          {cities.map((city) => (
            <Link
              key={city}
              href={`/events?city=${encodeURIComponent(city.toLowerCase())}`}
              className="shrink-0 rounded-full border border-[#E6D8C9]/15 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[#E6D8C9]/75 transition-colors hover:border-accent/50 hover:text-[#F5F3EE]"
            >
              {city}
            </Link>
          ))}
        </div>
      </section>

      {/* UPCOMING DROPS ------------------------------------------------- */}
      <section className="container py-16 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="mono-stub text-[#E6D8C9]/55">Curated</span>
            <h2 className="display mt-2 text-3xl md:text-5xl">Upcoming drops</h2>
          </div>
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
            description="New ticket drops will appear here soon."
          />
        )}
      </section>

      {/* USER VALUE BLOCK ----------------------------------------------- */}
      <section className="border-y border-border bg-[#0b0b0b]">
        <div className="container py-20 md:py-24">
          <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div className="space-y-6">
              <span className="mono-stub text-[#E6D8C9]/55">For fans</span>
              <h2 className="display text-4xl md:text-6xl">
                Looking for an event?<br />
                <span className="gradient-text">We&apos;ve got you covered.</span>
              </h2>
              <p className="max-w-md text-lg text-[#E6D8C9]/75">
                One wallet for every ticket. Scan at the door, transfer to a friend, or resell at face value through
                the official MISO exchange.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/events">Explore events</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/marketplace">Visit exchange</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Compass,
                  title: "Discover the best events",
                  body: "Curated drops from venues, festivals, and collectives across Europe.",
                },
                {
                  icon: WalletCards,
                  title: "One wallet, every ticket",
                  body: "Festival passes, VIP perks and rewards live in your MISO wallet.",
                },
                {
                  icon: Repeat,
                  title: "Resell, safely",
                  body: "Plans change. Resell at fair price through verified transfers.",
                },
                {
                  icon: ShieldCheck,
                  title: "Verified access",
                  body: "On-chain ownership and QR check-in stop fakes at the door.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-card/80 p-6 transition-colors hover:border-accent/40"
                >
                  <Icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-3 text-lg font-semibold text-[#F5F3EE]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#E6D8C9]/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ORGANIZER B2B BLOCK -------------------------------------------- */}
      <section className="container py-20 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-[#E6D8C9]/15 bg-[linear-gradient(135deg,#181410_0%,#2b2620_60%,#0d0d0d_100%)] p-8 md:p-14">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
          />
          <div className="relative grid gap-12 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="space-y-6">
              <span className="mono-stub text-accent">For organizers</span>
              <h2 className="display text-4xl text-[#F5F3EE] md:text-6xl">
                Organizing an event?<br />
                Find your audience.
              </h2>
              <p className="max-w-md text-lg text-[#E6D8C9]/80">
                Sell tickets to the right person, at the right time, with the right message, at the right price.
                Smart pricing, anti-scalping rules and a real-time dashboard built for promoters.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/signup/organizer">Publish my event</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <LandingMediaStack settings={siteSettings} />
              <ul className="grid gap-3">
                {[
                  {
                    icon: Megaphone,
                    title: "Reach the right crowd",
                    body: "Segment by city, scene and past attendance - direct push to the wallet.",
                  },
                  {
                    icon: Gem,
                    title: "Smart pricing tiers",
                    body: "Dynamic categories, VIP drops and waitlist sales without scripts.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Bouncer-grade entry",
                    body: "Controller mode scans QR codes offline. No more screenshots at the door.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex items-start gap-4 rounded-2xl border border-[#E6D8C9]/10 bg-black/30 p-5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#F5F3EE]">{title}</h3>
                      <p className="mt-1 text-sm text-[#E6D8C9]/70">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

function LandingMediaStack({
  settings,
}: {
  settings: Awaited<ReturnType<typeof loadSiteSettings>>;
}) {
  const audience = settings?.landing_audience_url;
  const dashboard = settings?.landing_dashboard_url;

  if (!audience && !dashboard) return null;

  return (
    <div className="relative min-h-72 overflow-hidden rounded-2xl border border-[#E6D8C9]/10 bg-black/30">
      {audience ? (
        <Image
          src={audience}
          alt=""
          fill
          sizes="(min-width: 768px) 45vw, 100vw"
          className="object-cover opacity-85"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#121212,#2b2620_55%,#E6D8C9)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {dashboard ? (
        <div className="absolute bottom-4 right-4 h-32 w-[58%] overflow-hidden rounded-xl border border-[#E6D8C9]/20 bg-black shadow-2xl md:h-40">
          <Image
            src={dashboard}
            alt=""
            fill
            sizes="(min-width: 768px) 25vw, 60vw"
            className="object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
