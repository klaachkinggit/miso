"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ChevronRight, Store } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
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
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="mb-12 flex items-end justify-between gap-6">
          <Reveal>
            <div>
              <p className="eyebrow-signal">Live on MISO</p>
              <h2 className="display mt-4 text-3xl text-foreground md:text-5xl">
                Organizers shipping with us.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <Button asChild variant="ghost" size="sm">
              <Link href="/events">
                All events <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((organization, i) => (
            <motion.div
              key={organization.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: 0.7,
                delay: i * 0.07,
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
  return (
    <SpotlightCard className="bg-ink-raised">
      <Link
        href={`/s/${encodeURIComponent(organization.slug)}`}
        className="relative flex items-center gap-4 p-6 transition-colors hover:bg-ink-soft"
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
    </SpotlightCard>
  );
}
