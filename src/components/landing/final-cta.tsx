"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Palette, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { MagneticButton } from "@/components/motion/magnetic-button";
import { WordReveal } from "@/components/motion/word-reveal";

const CHECKLIST: { icon: LucideIcon; label: string }[] = [
  { icon: Palette, label: "Storefront live in minutes — your logo, your tiers, your copy." },
  { icon: CreditCard, label: "Stripe Connect onboarding in the next step." },
  { icon: Repeat, label: "Resale and royalties configured per-event." },
  { icon: ShieldCheck, label: "Offline-capable door scanning, free of charge." },
];

export function FinalCta() {
  return (
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Reveal>
              <p className="eyebrow-signal">Get set up</p>
            </Reveal>
            <WordReveal
              className="display mt-6 text-5xl text-foreground md:text-7xl"
              segments={[
                { text: "Publish your" },
                { break: true, text: "" },
                { text: "first event" },
                { break: true, text: "" },
                { text: "tonight.", italic: true, color: "hsl(var(--signal))" },
              ]}
            />
            <Reveal delay={0.6}>
              <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
                Create your organization, hook up Stripe Connect, design your storefront — and publish.
                No sales call required, no subscription.
              </p>
            </Reveal>
            <Reveal delay={0.75}>
              <div className="mt-9 flex flex-wrap gap-3">
                <MagneticButton>
                  <Button asChild size="lg">
                    <Link href="/signup/organizer">
                      Start free <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </MagneticButton>
                <MagneticButton strength={0.2}>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Log in</Link>
                  </Button>
                </MagneticButton>
              </div>
            </Reveal>
          </div>
          <ul className="space-y-px overflow-hidden rounded-md border border-hairline bg-hairline">
            {CHECKLIST.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{
                  duration: 0.65,
                  delay: i * 0.08,
                  ease: [0.22, 0.72, 0.18, 1],
                }}
                className="flex items-start gap-4 bg-ink-raised px-5 py-4 text-sm text-muted-foreground"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal/15 text-signal">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{label}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
