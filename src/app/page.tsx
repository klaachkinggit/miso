import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Gem,
  Megaphone,
  Palette,
  Repeat,
  ShieldCheck,
  Sparkles,
  Store,
  TicketCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/event-card";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadSiteSettings } from "@/lib/site/settings";
import { organizationStorefrontPath } from "@/lib/organizations/public";
import type { EventRow, Organization } from "@/types/db";

type StorefrontRow = Pick<Organization, "id" | "name" | "slug" | "branding">;

export default async function HomePage() {
  const sb = createServiceClient();
  const [profile, siteSettings] = await Promise.all([getCurrentProfile(), loadSiteSettings()]);
  redirectIfCannotUseBuyerSurface(profile);

  const [{ data: events }, { data: storefronts }] = await Promise.all([
    sb
      .from("events")
      .select("*")
      .eq("status", "published")
      .order("date", { ascending: true })
      .limit(6)
      .returns<EventRow[]>(),
    sb
      .from("organizations")
      .select("id, name, slug, branding")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<StorefrontRow[]>(),
  ]);

  const upcoming = events ?? [];
  const liveStorefronts = storefronts ?? [];

  return (
    <div className="pb-20 md:pb-0">
      {/* HERO — SaaS pitch -------------------------------------------- */}
      <section className="relative isolate overflow-hidden border-b border-border">
        {siteSettings?.landing_hero_bg_url ? (
          <Image
            src={siteSettings.landing_hero_bg_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover opacity-60 saturate-[0.95]"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 22% 12%, rgba(184,155,94,0.32), transparent 36rem)," +
              "radial-gradient(circle at 82% 30%, rgba(230,216,201,0.12), transparent 30rem)," +
              "linear-gradient(90deg, rgba(7,7,7,0.92) 0%, rgba(7,7,7,0.78) 55%, rgba(7,7,7,0.55) 100%)," +
              "linear-gradient(180deg, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.62) 60%, #111111 100%)",
          }}
        />
        <div className="container grid items-center gap-12 py-20 md:grid-cols-[1.15fr_0.85fr] md:py-28">
          <div className="space-y-7">
            <span className="mono-stub inline-flex items-center gap-2 rounded-full border border-[#E6D8C9]/20 bg-[#121212]/70 px-3 py-1 text-[#E6D8C9]/80">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Ticketing platform for organizers
            </span>
            <h1 className="display max-w-2xl text-5xl text-[#F5F3EE] md:text-7xl lg:text-[5.25rem]">
              Sell tickets<br />
              <span className="gradient-text">your way.</span>
            </h1>
            <p className="max-w-xl text-lg text-[#E6D8C9]/80 md:text-xl">
              Branded storefronts, Stripe payouts, anti-scalping resale, real-time analytics. Everything
              your venue, festival or collective needs to run sales — without the platform fee surprise.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup/organizer">
                  Start your ticketing page <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-sm text-[#E6D8C9]/70">
              <span>200+ venues onboarded</span>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span>Stripe Connect payouts</span>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span>Anti-scalping enforced</span>
            </div>
          </div>

          {/* Hero visual: dashboard preview if available */}
          <div className="relative hidden md:block">
            <div className="absolute -left-10 -top-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-12 -right-6 h-72 w-72 rounded-full bg-[#E6D8C9]/10 blur-3xl" aria-hidden />
            {siteSettings?.landing_dashboard_url ? (
              <div className="relative aspect-[5/6] w-full max-w-md overflow-hidden rounded-3xl border border-[#E6D8C9]/15 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.9)]">
                <Image
                  src={siteSettings.landing_dashboard_url}
                  alt="Promoter dashboard preview"
                  fill
                  priority
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
                <div className="absolute inset-x-5 top-5">
                  <span className="mono-stub rounded-full bg-[#E6D8C9] px-3 py-1 text-[#121212]">
                    Live dashboard
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative aspect-[5/6] w-full max-w-md rounded-3xl border border-[#E6D8C9]/15 bg-[linear-gradient(145deg,#121212,#2b2620_55%,#E6D8C9)] p-8">
                <div className="space-y-4 text-[#F5F3EE]">
                  <span className="mono-stub rounded-full bg-black/40 px-3 py-1">Promoter dashboard</span>
                  <h2 className="display text-3xl">Watch demand move in real time.</h2>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TRUST STRIP -------------------------------------------------- */}
      <section className="border-b border-border bg-[#0d0d0d]">
        <div className="container flex flex-wrap items-center justify-between gap-6 py-6 text-sm text-[#E6D8C9]/65">
          <span className="mono-stub text-[#E6D8C9]/55">Powering organizers across Europe</span>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span>Clubs & venues</span>
            <span className="hidden h-3 w-px bg-border md:block" />
            <span>Festivals</span>
            <span className="hidden h-3 w-px bg-border md:block" />
            <span>Immersive art</span>
            <span className="hidden h-3 w-px bg-border md:block" />
            <span>Cultural collectives</span>
          </div>
        </div>
      </section>

      {/* FEATURE GRID — organizer-first ------------------------------- */}
      <section id="how-it-works" className="container py-20 md:py-24">
        <div className="mb-12 max-w-3xl">
          <span className="mono-stub text-[#E6D8C9]/55">Built for promoters</span>
          <h2 className="display mt-3 text-4xl md:text-5xl">
            Everything your ticketing business needs,<br />
            <span className="gradient-text">none of the gatekeeping.</span>
          </h2>
          <p className="mt-4 max-w-xl text-lg text-[#E6D8C9]/72">
            One workspace per organization. Bring your team, configure payouts, design your storefront,
            and sell to fans — directly.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Store,
              title: "Your own storefront",
              body: "Branded subdomain at /s/your-org with your colors, copy, and event lineup. Looks nothing like a generic marketplace.",
            },
            {
              icon: CreditCard,
              title: "Stripe Connect payouts",
              body: "Each organization gets its own Stripe account. Money lands in your bank, not ours. Buyer fees stay transparent.",
            },
            {
              icon: ShieldCheck,
              title: "Anti-scalping resale",
              body: "Official exchange per organizer. Price caps, royalties, and verified transfers — no Telegram scams at the door.",
            },
            {
              icon: BarChart3,
              title: "Real-time analytics",
              body: "Sellout pace, attendance, revenue per tier. Decide pricing and capacity before the event, not after.",
            },
            {
              icon: TicketCheck,
              title: "Bouncer-grade entry",
              body: "Controller mode scans QR codes offline. Door staff get one role — scan and let people in.",
            },
            {
              icon: Palette,
              title: "Smart pricing tiers",
              body: "Dynamic categories, VIP drops, waitlist sales. Configure it once, the platform handles the rest.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-6 transition-colors hover:border-accent/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#F5F3EE]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#E6D8C9]/72">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DASHBOARD SHOWCASE ------------------------------------------ */}
      <DashboardShowcase settings={siteSettings} />

      {/* LIVE STOREFRONTS -------------------------------------------- */}
      {liveStorefronts.length ? (
        <section className="container py-20 md:py-24">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <span className="mono-stub text-[#E6D8C9]/55">Live on MISO</span>
              <h2 className="display mt-2 text-3xl md:text-5xl">Organizers building with us</h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/events">Explore all events →</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveStorefronts.map((organization) => (
              <StorefrontCard key={organization.id} organization={organization} />
            ))}
          </div>
        </section>
      ) : null}

      {/* FINAL ORGANIZER CTA ----------------------------------------- */}
      <section className="container py-16 md:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-[#E6D8C9]/15 bg-[linear-gradient(135deg,#181410_0%,#2b2620_55%,#0d0d0d_100%)] p-10 md:p-16">
          <div
            aria-hidden
            className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl"
          />
          <div className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div className="space-y-5">
              <span className="mono-stub text-accent">Ready when you are</span>
              <h2 className="display text-4xl text-[#F5F3EE] md:text-6xl">
                Launch your ticketing page<br />in minutes.
              </h2>
              <p className="max-w-md text-lg text-[#E6D8C9]/80">
                Create your organization, hook up Stripe, publish your first event. No sales call required.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/signup/organizer">
                    Start your ticketing page <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Already a member? Log in</Link>
                </Button>
              </div>
            </div>
            <ul className="grid gap-3 text-sm">
              {[
                { icon: Megaphone, label: "Reach the right crowd, segmented by city and scene" },
                { icon: Gem, label: "Smart pricing tiers, VIP drops, waitlists" },
                { icon: Repeat, label: "Official resale with royalties, no Telegram chaos" },
                { icon: ShieldCheck, label: "Door scanning that works offline" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-2xl border border-[#E6D8C9]/10 bg-black/30 p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[#E6D8C9]/80">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* BUYER FOOTER BLOCK (demoted) -------------------------------- */}
      <section className="border-t border-border bg-[#0b0b0b]">
        <div className="container grid gap-10 py-16 md:grid-cols-[1fr_1.2fr] md:items-center md:py-20">
          <div className="space-y-4">
            <span className="mono-stub text-[#E6D8C9]/55">For fans</span>
            <h2 className="display text-3xl text-[#F5F3EE] md:text-4xl">Looking for an event?</h2>
            <p className="max-w-md text-[#E6D8C9]/75">
              Browse upcoming drops from organizers across the platform, or head directly to your favorite
              venue&apos;s storefront.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/events">Explore events</Link>
              </Button>
            </div>
          </div>
          {upcoming.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.slice(0, 4).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StorefrontCard({ organization }: { organization: StorefrontRow }) {
  const branding = (organization.branding ?? null) as { logo_url?: string | null } | null;
  const logoUrl = branding?.logo_url ?? null;
  return (
    <Link
      href={organizationStorefrontPath(organization.slug)}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-accent/50"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E6D8C9]/10 text-accent">
        {logoUrl ? (
          <Image src={logoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[#F5F3EE]">{organization.name}</p>
        <p className="mono-stub truncate text-[#E6D8C9]/60">/s/{organization.slug}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

function DashboardShowcase({
  settings,
}: {
  settings: Awaited<ReturnType<typeof loadSiteSettings>>;
}) {
  const dashboard = settings?.landing_dashboard_url;

  return (
    <section className="border-y border-border bg-[#0b0b0b]">
      <div className="container py-20 md:py-24">
        <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-center">
          <div className="space-y-5">
            <span className="mono-stub text-accent">Promoter dashboard</span>
            <h2 className="display text-3xl text-[#F5F3EE] md:text-5xl">
              Watch demand move in real time.
            </h2>
            <p className="max-w-md text-[#E6D8C9]/75">
              Keep sales, tiers, resale pressure, and gate activity visible from one operational surface —
              one organization, one workspace, one source of truth.
            </p>
          </div>
          {dashboard ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#E6D8C9]/16 bg-black shadow-[0_26px_90px_-58px_rgba(0,0,0,0.95)]">
              <Image
                src={dashboard}
                alt="Organizer dashboard preview"
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-top"
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/8" />
            </div>
          ) : (
            <div className="aspect-[16/10] rounded-2xl border border-[#E6D8C9]/15 bg-[linear-gradient(145deg,#121212,#2b2620_55%,#E6D8C9)]" />
          )}
        </div>
      </div>
    </section>
  );
}
