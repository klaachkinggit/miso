"use client";

import {
  BarChart3,
  CreditCard,
  ShieldCheck,
  Store,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

type Row = {
  n: string;
  icon: LucideIcon;
  title: string;
  body: string;
};

const ROWS: Row[] = [
  {
    n: "01",
    icon: Store,
    title: "Branded storefront.",
    body: "Each organization gets /s/your-org — your colors, your lineup, your story. Buyers never touch a generic marketplace.",
  },
  {
    n: "02",
    icon: CreditCard,
    title: "Direct Stripe payouts.",
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

export function Capabilities() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="capabilities" className="border-b border-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.4fr_0.6fr] lg:gap-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.7, ease: [0.22, 0.72, 0.18, 1] }}
              className="eyebrow"
            >
              Capabilities · 01 — 05
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 0.72, 0.18, 1] }}
              className="display mt-6 text-4xl text-foreground md:text-5xl lg:text-6xl"
            >
              Everything an organizer needs.
              <br />
              <span className="display-italic text-muted-foreground">Nothing they don&apos;t.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground"
            >
              One workspace per organization. Bring your team, configure payouts, design your
              storefront, and sell directly to fans.
            </motion.p>
          </div>
          <div ref={ref} className="relative">
            <div aria-hidden className="absolute left-0 top-0 bottom-0 hidden w-px bg-hairline md:block" />
            <motion.div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 hidden w-px origin-top bg-signal md:block"
              style={{ scaleY: railScale }}
            />
            <ol className="border-y border-hairline">
              {ROWS.map((row, i) => (
                <CapabilityRow key={row.n} row={row} index={i} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityRow({ row, index }: { row: Row; index: number }) {
  const { icon: Icon } = row;
  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.06,
        ease: [0.22, 0.72, 0.18, 1],
      }}
      className="group grid grid-cols-[auto_auto_1fr] items-start gap-6 border-b border-hairline bg-ink-raised/40 px-2 py-8 last:border-b-0 transition-colors hover:bg-ink-raised md:pl-8 md:pr-6"
    >
      <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-signal">
        {row.n}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-ink text-signal transition-all duration-300 group-hover:scale-105 group-hover:border-signal/60">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="display text-[22px] text-foreground md:text-[26px]">{row.title}</h3>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{row.body}</p>
      </div>
    </motion.li>
  );
}
