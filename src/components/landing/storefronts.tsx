"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Store } from "lucide-react";
import { motion } from "motion/react";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightCard } from "@/components/motion/spotlight-card";

export type StorefrontRow = {
  id: string;
  name: string;
  slug: string;
  branding: { logo_url?: string | null } | null;
};

export function Storefronts({ storefronts }: { storefronts: StorefrontRow[] }) {
  if (!storefronts.length) return null;

  return (
    <section className="border-b border-hairline bg-ink">
      <div className="container py-24 md:py-32">
        {/* Editorial scaffold */}
        <div className="mb-16 flex items-end justify-between gap-6">
          <Reveal>
            <div>
              <p
                aria-hidden="true"
                className="eyebrow mb-3 text-muted-foreground"
              >
                §05 / 06
              </p>
              <p className="eyebrow-signal mb-4">Live on MISO</p>
              <h2 className="type-section-head text-foreground">
                Organizers shipping<br />
                <em className="display-italic">with us.</em>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <Link
              href="/events"
              className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            >
              All events
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>

        {/* Storefront grid */}
        <div className="grid gap-px overflow-hidden rounded-sm border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((organization, i) => (
            <motion.div
              key={organization.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: 0.7,
                delay: i * 0.055,
                ease: [0.22, 0.72, 0.18, 1],
              }}
            >
              <StorefrontCard organization={organization} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StorefrontCard({ organization }: { organization: StorefrontRow }) {
  const logoUrl = organization.branding?.logo_url ?? null;
  const slug = organization.slug;
  const href = `/s/${encodeURIComponent(slug)}`;

  return (
    <SpotlightCard className="bg-ink-raised">
      <Link
        href={href}
        className="group relative flex flex-col gap-0 transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal"
        aria-label={`${organization.name} — open storefront`}
      >
        {/* Mini storefront preview */}
        <div
          aria-hidden="true"
          className="relative mx-0 overflow-hidden border-b border-hairline"
          style={{ aspectRatio: "16 / 10" }}
        >
          {/* Browser chrome */}
          <div className="absolute inset-x-0 top-0 z-10 flex h-6 items-center gap-2 border-b border-hairline bg-ink px-3">
            {/* Traffic-light dots (decorative) */}
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
              <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
              <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
            </span>
            {/* URL bar */}
            <span className="flex min-w-0 flex-1 items-center justify-center">
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                miso.app/s/{slug}
              </span>
            </span>
          </div>

          {/* Storefront "page" body */}
          <div className="absolute inset-0 top-6 flex flex-col bg-ink-soft">
            {/* Header swatch — neutral ink-elevated (no branding accent invented) */}
            <div className="relative flex items-end px-4 pb-3 pt-3" style={{ background: "hsl(var(--ink-elevated))" }}>
              {/* Logo or icon */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-ink text-signal">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-3.5 w-3.5" />
                )}
              </span>
            </div>

            {/* Placeholder event rows — structural, not data */}
            <div className="flex flex-col gap-px px-4 pt-3">
              <span className="h-1.5 w-3/4 rounded-sm bg-hairline" />
              <span className="mt-1 h-1.5 w-1/2 rounded-sm bg-hairline" />
              <span className="mt-2 h-1 w-2/5 rounded-sm bg-hairline opacity-50" />
            </div>
          </div>

          {/* Hover veil */}
          <div className="pointer-events-none absolute inset-0 bg-signal opacity-0 transition-opacity duration-300 group-hover:opacity-[0.03]" />
        </div>

        {/* Card foot — name + slug + arrow */}
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Logo — full-size for identity */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-ink text-signal">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium leading-snug text-foreground">
              {organization.name}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              /s/{slug}
            </p>
          </div>

          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal"
            aria-hidden="true"
          />
        </div>
      </Link>
    </SpotlightCard>
  );
}
