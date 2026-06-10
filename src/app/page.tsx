import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CreditCard,
  Palette,
  Repeat,
  ShieldCheck,
  Store,
  TicketCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { organizationStorefrontPath } from "@/lib/organizations/public";
import type { Organization } from "@/types/db";

type StorefrontRow = Pick<Organization, "id" | "name" | "slug" | "branding">;

export default async function HomePage() {
  const sb = createServiceClient();
  const profile = await getCurrentProfile();
  redirectIfCannotUseBuyerSurface(profile);

  const { data: storefronts } = await sb
    .from("organizations")
    .select("id, name, slug, branding")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<StorefrontRow[]>();

  const liveStorefronts = storefronts ?? [];

  return (
    <div className="pb-24 md:pb-0">
      <Hero />
      <ProofStrip />
      <Capabilities />
      <DashboardModule />
      <PaperSection />
      <Storefronts storefronts={liveStorefronts} />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-hairline">
      <BackgroundLines />
      <div className="container relative pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid gap-16 lg:grid-cols-[1.25fr_1fr] lg:gap-20">
          <div className="reveal max-w-2xl">
            <p className="eyebrow-signal flex items-center gap-2.5">
              <span className="ticker-mark" aria-hidden /> MISO · Ticketing infrastructure
            </p>
            <h1 className="display mt-7 text-[3.25rem] leading-[0.95] text-foreground md:text-[5.5rem] lg:text-[6.25rem]">
              Ticketing
              <br />
              without the
              <br />
              <span className="display-italic" style={{ color: "hsl(var(--signal))" }}>
                gatekeeper.
              </span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
              Branded storefronts, direct Stripe payouts, anti-scalping resale, real-time gate
              control. The infrastructure your venue runs on — not the marketplace it sells through.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup/organizer">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#capabilities">
                  See capabilities <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-hairline pt-6 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-signal" aria-hidden /> No platform fee surprise
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-signal" aria-hidden /> Stripe Connect payouts
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-signal" aria-hidden /> Offline door scanning
              </span>
            </div>
          </div>

          <div className="reveal reveal-delay-2 relative hidden lg:block">
            <HeroPanel />
          </div>
        </div>
      </div>
    </section>
  );
}

function BackgroundLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          "linear-gradient(to right, hsl(var(--hairline) / 0.5) 1px, transparent 1px)," +
          "linear-gradient(to bottom, hsl(var(--hairline) / 0.5) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
        maskImage:
          "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 100%)",
      }}
    />
  );
}

function HeroPanel() {
  return (
    <div className="relative aspect-[5/6] w-full max-w-md ml-auto">
      <div className="absolute inset-0 rounded-md border border-hairline-strong bg-ink-raised">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="ticker-mark" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Live dashboard
            </span>
          </div>
          <div className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-hairline">
          {[
            { label: "Sold today", value: "412", delta: "+38%" },
            { label: "Gross", value: "€18,420", delta: "+12%" },
            { label: "Door scanned", value: "97%", delta: "live" },
            { label: "Resale queue", value: "23", delta: "@ cap" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-ink-raised px-4 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kpi.label}
              </p>
              <p className="display mt-2 text-2xl text-foreground">{kpi.value}</p>
              <p className="mt-1 font-mono text-[10px] text-signal">{kpi.delta}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 px-4 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Tonight · NIGHT VOLTAGE
          </p>
          <div className="space-y-2">
            {[
              { tier: "General", sold: 82 },
              { tier: "VIP Pit", sold: 96 },
              { tier: "Door", sold: 41 },
            ].map((row) => (
              <div key={row.tier}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{row.tier}</span>
                  <span className="font-mono text-foreground">{row.sold}%</span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-soft">
                  <div
                    className="h-full bg-signal"
                    style={{ width: `${row.sold}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-hairline px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="text-signal">●</span> Stripe payout · €4,820 · in 21h
        </div>
      </div>
      <div
        aria-hidden
        className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-signal/20 blur-3xl"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proof strip                                                         */
/* ------------------------------------------------------------------ */

function ProofStrip() {
  const items = [
    "200+ organizers",
    "€4.2M in payouts",
    "0 scalping markup",
    "31 EU cities",
    "Stripe Connect",
    "Base Sepolia",
  ];
  return (
    <section className="border-b border-hairline bg-ink">
      <div className="container flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
        <p className="eyebrow">Powering organizers across Europe</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {items.map((item, idx) => (
            <span key={item} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              {item}
              {idx < items.length - 1 ? (
                <span aria-hidden className="h-3 w-px bg-hairline" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Capabilities — editorial 01-05 list                                 */
/* ------------------------------------------------------------------ */

function Capabilities() {
  const rows = [
    {
      n: "01",
      icon: Store,
      title: "Branded storefront.",
      body: "Each organization gets /s/your-org — your colors, your lineup, your story. Buyers never touch a generic marketplace.",
    },
    {
      n: "02",
      icon: CreditCard,
      title: "Direct Stripe Connect payouts.",
      body: "Money lands in your bank, on your tax ID. We never hold your funds. Transparent buyer fees, no platform skim.",
    },
    {
      n: "03",
      icon: ShieldCheck,
      title: "Anti-scalping resale.",
      body: "Official exchange with price caps and verified ERC-721 transfer. Listings above the cap are rejected at submit.",
    },
    {
      n: "04",
      icon: TicketCheck,
      title: "Door-grade entry.",
      body: "Controller mode scans QR codes offline. Door staff get one role — scan, allow, repeat.",
    },
    {
      n: "05",
      icon: BarChart3,
      title: "Real-time analytics.",
      body: "Tier velocity, resale pressure, payout schedule, scan log. Decide pricing and capacity before the event ends.",
    },
  ];

  return (
    <section id="capabilities" className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.4fr_0.6fr] lg:gap-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">Capabilities · 01 — 05</p>
            <h2 className="display mt-6 text-4xl text-foreground md:text-5xl lg:text-6xl">
              Everything an organizer needs.
              <br />
              <span className="display-italic text-muted-foreground">Nothing they don&apos;t.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              One workspace per organization. Bring your team, configure payouts, design your
              storefront, and sell directly to fans.
            </p>
          </div>
          <ol className="space-y-px overflow-hidden border-y border-hairline">
            {rows.map(({ n, icon: Icon, title, body }) => (
              <li
                key={n}
                className="group grid grid-cols-[auto_auto_1fr] items-start gap-6 border-b border-hairline bg-ink-raised/40 px-2 py-8 last:border-b-0 hover:bg-ink-raised md:px-6"
              >
                <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground">
                  {n}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-ink text-signal transition-colors group-hover:border-signal/50">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="display text-[22px] text-foreground md:text-[26px]">{title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard module — wide ink section                                 */
/* ------------------------------------------------------------------ */

function DashboardModule() {
  return (
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow-signal">Operational surface</p>
            <h2 className="display mt-6 text-4xl text-foreground md:text-5xl">
              Watch demand move<br />
              <span className="display-italic">in real time.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Sales velocity, resale queue, gate activity, payout calendar — all in one workspace.
              Built for the operator running tonight&apos;s door, not just analyzing last quarter.
            </p>
            <Link
              href="/admin"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-signal transition-colors hover:text-signal-pressed"
            >
              Open workspace
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <FullDashboardMock />
        </div>
      </div>
    </section>
  );
}

function FullDashboardMock() {
  const kpis = [
    { label: "Tonight gross", value: "€42,180" },
    { label: "Tickets sold", value: "1,247" },
    { label: "Avg ticket", value: "€33.80" },
    { label: "Capacity", value: "84%" },
  ];
  const events = [
    { name: "Night Voltage · Sat", tier: "VIP", sold: 96, gross: "€8,420" },
    { name: "Cosmic Wash · Fri", tier: "General", sold: 71, gross: "€4,210" },
    { name: "Tunnel 33 · Thu", tier: "Door", sold: 48, gross: "€2,180" },
    { name: "Loop Festival · Aug", tier: "Early", sold: 22, gross: "€1,840" },
  ];

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border border-hairline-strong bg-ink-raised">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="ticker-mark" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Atelier Sonique · workspace
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">v1.4 · live</span>
        </div>
        <div className="grid grid-cols-4 gap-px bg-hairline">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-ink-raised px-4 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kpi.label}
              </p>
              <p className="display mt-2 text-xl text-foreground md:text-2xl">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-px bg-hairline md:grid-cols-[1.4fr_1fr]">
          <div className="bg-ink-raised p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Sales velocity · 7d
              </p>
              <p className="font-mono text-[10px] text-signal">+38% wow</p>
            </div>
            <SparkChart />
          </div>
          <div className="bg-ink-raised p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Upcoming events
            </p>
            <ul className="space-y-3">
              {events.map((event) => (
                <li
                  key={event.name}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">{event.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {event.tier} · {event.sold}%
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-foreground">{event.gross}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-hairline px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>
            <span className="text-signal">●</span> Stripe payout · €12,402 · clears in 18h
          </span>
          <span>Last sync · 2s ago</span>
        </div>
      </div>
    </div>
  );
}

function SparkChart() {
  const points = [22, 28, 24, 41, 36, 58, 64, 71, 68, 82, 78, 94];
  const max = Math.max(...points);
  return (
    <div className="flex h-32 items-end gap-1.5">
      {points.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${(p / max) * 100}%`,
            background:
              i === points.length - 1
                ? "hsl(var(--signal))"
                : "hsl(var(--hairline-strong))",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paper inversion section — pricing transparency                      */
/* ------------------------------------------------------------------ */

function PaperSection() {
  return (
    <section className="paper-section border-b border-paper-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.45fr_0.55fr] lg:items-end lg:gap-20">
          <div>
            <p className="eyebrow" style={{ color: "hsl(var(--muted-paper))" }}>
              Pricing
            </p>
            <h2 className="display mt-6 text-4xl text-ink md:text-6xl">
              No subscription.
              <br />
              <span className="display-italic">No surprise skim.</span>
            </h2>
          </div>
          <div className="space-y-px overflow-hidden rounded-md border border-paper-hairline bg-paper-hairline">
            {[
              {
                label: "Service fee",
                value: "1.9%",
                note: "Charged to the buyer at checkout. Never to the organizer.",
              },
              {
                label: "Stripe processing",
                value: "Pass-through",
                note: "Whatever Stripe charges, we surface — no markup, no rounding.",
              },
              {
                label: "Payout cadence",
                value: "T+1",
                note: "Stripe Connect to your bank account on your tax ID. We never custody funds.",
              },
              {
                label: "Resale royalty",
                value: "You decide",
                note: "Configure 0–10% per event. Royalties flow to your Stripe account.",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="grid gap-2 bg-paper px-5 py-5 md:grid-cols-[auto_1fr] md:items-center md:gap-8"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-paper))]">
                    {row.label}
                  </span>
                  <span className="display text-2xl text-ink">{row.value}</span>
                </div>
                <p className="text-sm text-[hsl(var(--muted-paper))]">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live storefronts                                                    */
/* ------------------------------------------------------------------ */

function Storefronts({ storefronts }: { storefronts: StorefrontRow[] }) {
  if (!storefronts.length) return null;
  return (
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow-signal">Live on MISO</p>
            <h2 className="display mt-4 text-3xl text-foreground md:text-5xl">
              Organizers shipping with us.
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">
              All events <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((organization) => (
            <StorefrontCard key={organization.id} organization={organization} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StorefrontCard({ organization }: { organization: StorefrontRow }) {
  const branding = (organization.branding ?? null) as { logo_url?: string | null } | null;
  const logoUrl = branding?.logo_url ?? null;
  return (
    <Link
      href={organizationStorefrontPath(organization.slug)}
      className="group flex items-center gap-4 bg-ink-raised p-6 transition-colors hover:bg-ink-soft"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-ink text-signal">
        {logoUrl ? (
          <Image src={logoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-foreground">{organization.name}</p>
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          /s/{organization.slug}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta() {
  const checklist = [
    { icon: Palette, label: "Storefront live in minutes — your logo, your tiers, your copy." },
    { icon: CreditCard, label: "Stripe Connect onboarding in the next step." },
    { icon: Repeat, label: "Resale and royalties configured per-event." },
    { icon: ShieldCheck, label: "Offline-capable door scanning, free of charge." },
  ];

  return (
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow-signal">Get set up</p>
            <h2 className="display mt-6 text-5xl text-foreground md:text-7xl">
              Publish your<br />
              first event<br />
              <span className="display-italic" style={{ color: "hsl(var(--signal))" }}>
                tonight.
              </span>
            </h2>
            <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
              Create your organization, hook up Stripe Connect, design your storefront — and publish.
              No sales call required, no subscription.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup/organizer">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
          <ul className="space-y-px overflow-hidden rounded-md border border-hairline bg-hairline">
            {checklist.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-start gap-4 bg-ink-raised px-5 py-4 text-sm text-muted-foreground"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal/15 text-signal">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
