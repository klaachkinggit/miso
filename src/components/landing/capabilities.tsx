"use client";

import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef } from "react";

type Row = {
  n: string;
  title: string;
  body: string;
};

const ROWS: Row[] = [
  {
    n: "01",
    title: "Branded storefront.",
    body: "Each organization gets /s/your-org — your colors, your lineup, your story. Buyers never touch a generic marketplace.",
  },
  {
    n: "02",
    title: "Direct Stripe payouts.",
    body: "Money lands in your bank, on your tax ID. We never hold your funds. Transparent buyer fees, no platform skim.",
  },
  {
    n: "03",
    title: "Anti-scalping resale.",
    body: "Official exchange with price caps and verified digital transfer. Listings above the cap are rejected at submit.",
  },
  {
    n: "04",
    title: "Door-grade entry.",
    body: "Controller mode scans QR codes offline. Door staff get one role — scan, allow, repeat.",
  },
  {
    n: "05",
    title: "Real-time analytics.",
    body: "Tier velocity, resale pressure, payout schedule, scan log. Decide pricing and capacity before the event ends.",
  },
];

export function Capabilities() {
  const reduced = useReducedMotion();
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
          {/* Sticky left column */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.7, ease: [0.22, 0.72, 0.18, 1] }}
              className="eyebrow"
            >
              {/* Editorial index — aria-hidden so screen readers skip the decoration */}
              <span
                aria-hidden
                className="mr-2 font-mono text-muted-foreground"
              >
                §03 / 06
              </span>
              Capabilities · 01 — 05
            </motion.p>
            <motion.h2
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{
                duration: 0.9,
                delay: 0.1,
                ease: [0.22, 0.72, 0.18, 1],
              }}
              className="display mt-6 text-4xl text-foreground md:text-5xl lg:text-6xl"
            >
              Everything an organizer needs.
              <br />
              <span className="display-italic text-muted-foreground">
                Nothing they don&apos;t.
              </span>
            </motion.h2>
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground"
            >
              One workspace per organization. Bring your team, configure
              payouts, design your storefront, and sell directly to fans.
            </motion.p>
          </div>

          {/* Right column: scroll-tracked rail + rows */}
          <div ref={ref} className="relative">
            {/* Static hairline rail */}
            <div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 hidden w-px bg-hairline md:block"
            />
            {/* Signal rail: fills as user scrolls */}
            <motion.div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 hidden w-px origin-top bg-signal md:block"
              style={{ scaleY: reduced ? 1 : railScale }}
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
  const rowRef = useRef<HTMLLIElement>(null);
  const shouldReduceMotion = useReducedMotion();
  // useInView triggers .is-lit; once:true so it stays lit after scrolling past
  const inView = useInView(rowRef, { once: true, margin: "-12% 0px" });

  return (
    <motion.li
      ref={rowRef}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{
        duration: 0.7,
        delay: shouldReduceMotion ? 0 : index * 0.06,
        ease: [0.22, 0.72, 0.18, 1],
      }}
      // edge-light: 2px signal segment on left; .is-lit reveals it when in-view
      // group: allows hover to also reveal it
      className={[
        "group edge-light",
        inView ? "is-lit" : "",
        "grid grid-cols-[5rem_1fr] items-start gap-6 border-b border-hairline",
        "bg-ink-raised/40 px-2 py-8 last:border-b-0",
        "transition-colors hover:bg-ink-raised",
        "md:pl-8 md:pr-6",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Drop numeral — large display, tabular figures, leads the row */}
      <span
        aria-hidden
        className="display-numeric select-none text-4xl tabular-nums text-muted-foreground transition-colors duration-300 group-hover:text-foreground md:text-5xl"
      >
        {row.n}
      </span>

      {/* Text block */}
      <div>
        {/* Screen-reader-only number so the list item has a meaningful ordinal */}
        <span className="sr-only">{row.n}.</span>
        <h3 className="display text-[22px] text-foreground md:text-[26px]">
          {row.title}
        </h3>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {row.body}
        </p>
      </div>
    </motion.li>
  );
}
