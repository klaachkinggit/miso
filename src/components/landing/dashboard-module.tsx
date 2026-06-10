"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";

const KPIS = [
  { label: "Tonight gross", value: 42180, prefix: "€" },
  { label: "Tickets sold", value: 1247 },
  { label: "Avg ticket", value: 33.8, prefix: "€", decimals: 1 },
  { label: "Capacity", value: 84, suffix: "%" },
];

const EVENTS = [
  { name: "Night Voltage · Sat", tier: "VIP", sold: 96, gross: "€8,420" },
  { name: "Cosmic Wash · Fri", tier: "General", sold: 71, gross: "€4,210" },
  { name: "Tunnel 33 · Thu", tier: "Door", sold: 48, gross: "€2,180" },
  { name: "Loop Festival · Aug", tier: "Early", sold: 22, gross: "€1,840" },
];

const SPARK = [22, 28, 24, 41, 36, 58, 64, 71, 68, 82, 78, 94];

export function DashboardModule() {
  return (
    <section className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <Reveal>
              <p className="eyebrow-signal">Operational surface</p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="display mt-6 text-4xl text-foreground md:text-5xl">
                Watch demand move<br />
                <span className="display-italic">in real time.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Sales velocity, resale queue, gate activity, payout calendar — all in one workspace.
                Built for the operator running tonight&apos;s door, not just analyzing last quarter.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <Link
                href="/admin"
                className="group mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-signal transition-colors hover:text-signal-pressed"
              >
                Open workspace
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={0.2} y={48}>
            <FullDashboardMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FullDashboardMock() {
  const max = Math.max(...SPARK);
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border border-hairline-strong bg-ink-raised">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div className="flex items-center gap-2">
            <motion.span
              aria-hidden
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="ticker-mark"
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Atelier Sonique · workspace
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">v1.4 · live</span>
        </div>
        <div className="grid grid-cols-4 gap-px bg-hairline">
          {KPIS.map((kpi) => (
            <div key={kpi.label} className="bg-ink-raised px-4 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kpi.label}
              </p>
              <CountUp
                to={kpi.value}
                prefix={kpi.prefix ?? ""}
                suffix={kpi.suffix ?? ""}
                decimals={kpi.decimals ?? 0}
                className="display mt-2 block text-xl text-foreground md:text-2xl"
              />
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
            <div className="flex h-32 items-end gap-1.5">
              {SPARK.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{
                    duration: 0.7,
                    delay: 0.4 + i * 0.045,
                    ease: [0.22, 0.72, 0.18, 1],
                  }}
                  className="flex-1 origin-bottom rounded-sm"
                  style={{
                    height: `${(p / max) * 100}%`,
                    background:
                      i === SPARK.length - 1
                        ? "hsl(var(--signal))"
                        : "hsl(var(--hairline-strong))",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="bg-ink-raised p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Upcoming events
            </p>
            <ul className="space-y-3">
              {EVENTS.map((event, i) => (
                <motion.li
                  key={event.name}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{
                    duration: 0.6,
                    delay: 0.5 + i * 0.1,
                    ease: [0.22, 0.72, 0.18, 1],
                  }}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">{event.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {event.tier} · {event.sold}%
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-foreground">{event.gross}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-hairline px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>
            <motion.span
              aria-hidden
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="text-signal"
            >
              ●
            </motion.span>{" "}
            Stripe payout · €12,402 · clears in 18h
          </span>
          <span>Last sync · 2s ago</span>
        </div>
      </div>
    </div>
  );
}
