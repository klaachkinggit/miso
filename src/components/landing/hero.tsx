"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/motion/magnetic-button";
import { WordReveal } from "@/components/motion/word-reveal";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const blobY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden border-b border-hairline"
    >
      {/* Grid layer */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          y: gridY,
          backgroundImage:
            "linear-gradient(to right, hsl(var(--hairline) / 0.55) 1px, transparent 1px)," +
            "linear-gradient(to bottom, hsl(var(--hairline) / 0.55) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, black 35%, transparent 100%)",
        }}
      />
      {/* Single signal blob — the only ambient layer */}
      <motion.div
        aria-hidden
        style={{ y: blobY }}
        className="pointer-events-none absolute -right-32 top-10 -z-10 h-[480px] w-[480px] rounded-full bg-signal/12 blur-[120px]"
      />

      <div className="container relative pt-20 pb-24 md:pt-28 md:pb-32">
        {/* Section index */}
        <p aria-hidden className="mb-8 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground select-none">
          §01 / 06
        </p>

        <div className="grid gap-16 lg:grid-cols-[1.25fr_1fr] lg:gap-20">
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow-signal flex items-center gap-2.5">
                <motion.span
                  aria-hidden
                  animate={{
                    opacity: [0.4, 1, 0.4],
                    scale: [0.9, 1.1, 0.9],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="ticker-mark"
                />
                MISO · Ticketing infrastructure
              </p>
            </Reveal>

            {/* h1 wraps WordReveal (which renders a div internally) — exactly one h1 on the page */}
            <h1 className="type-masthead leading-[0.92] mt-7">
              <WordReveal
                segments={[
                  { text: "Ticketing" },
                  { break: true, text: "" },
                  { text: "without the" },
                  { break: true, text: "" },
                  { text: "gatekeeper.", italic: true, color: "hsl(var(--signal))" },
                ]}
              />
            </h1>

            <Reveal delay={0.45} y={20}>
              <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
                Branded storefronts, direct Stripe payouts, anti-scalping resale, real-time gate
                control. The infrastructure your venue runs on — not the marketplace it sells through.
              </p>
            </Reveal>

            <Reveal delay={0.6} y={20}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <MagneticButton>
                  <Button asChild size="lg">
                    <Link href="/signup/organizer">
                      Start free <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </MagneticButton>
                <MagneticButton strength={0.2}>
                  <Button asChild size="lg" variant="outline">
                    <Link href="#capabilities">
                      See capabilities <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </MagneticButton>
              </div>
            </Reveal>

            {/* KPI strip — baseline-ruled row, display-numeric scale */}
            <Reveal delay={0.75} y={16}>
              <div className="mt-12 md:max-w-lg">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
                  By the numbers
                </p>
                <div className="flex items-baseline gap-0 divide-x divide-hairline border-t border-hairline pt-5">
                  {[
                    { value: 237, suffix: "+", label: "Organizers" },
                    { value: 4.2, suffix: "M", prefix: "€", decimals: 1, label: "Paid out" },
                    { value: 31, suffix: "", label: "EU cities" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="flex-1 pl-5 first:pl-0 pr-5 last:pr-0">
                      <CountUp
                        to={kpi.value}
                        prefix={kpi.prefix ?? ""}
                        suffix={kpi.suffix}
                        decimals={kpi.decimals ?? 0}
                        className="display-numeric text-foreground"
                      />
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {kpi.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <motion.div style={{ y: panelY }} className="relative hidden lg:block">
            <Reveal delay={0.3} y={40}>
              <HeroPanel />
            </Reveal>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <div className="relative w-full max-w-sm ml-auto">
      <div className="rounded-md border border-hairline-strong bg-ink-raised glass-top-highlight">
        {/* Titlebar */}
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div className="flex items-center gap-2">
            <motion.span
              aria-hidden
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="ticker-mark"
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Live
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
            ))}
          </div>
        </div>

        {/* Tier bars */}
        <div className="space-y-3 px-4 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Tonight · NIGHT VOLTAGE
          </p>
          <div className="space-y-2.5">
            {[
              { tier: "General", sold: 82 },
              { tier: "VIP Pit", sold: 96 },
              { tier: "Door", sold: 41 },
            ].map((row, i) => (
              <TierRow key={row.tier} tier={row.tier} sold={row.sold} delay={1 + i * 0.15} />
            ))}
          </div>
        </div>

        {/* Stripe payout footer */}
        <div className="border-t border-hairline px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <motion.span
            aria-hidden
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-signal"
          >
            ●
          </motion.span>{" "}
          Stripe payout · €4,820 · in 21h
        </div>
      </div>
    </div>
  );
}

function TierRow({ tier, sold, delay }: { tier: string; sold: number; delay: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{tier}</span>
        <CountUp to={sold} suffix="%" className="font-mono text-foreground" />
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-soft">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: sold / 100 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1.2, delay, ease: [0.22, 0.72, 0.18, 1] }}
          style={{ transformOrigin: "left" }}
          className="h-full w-full bg-signal"
        />
      </div>
    </div>
  );
}
