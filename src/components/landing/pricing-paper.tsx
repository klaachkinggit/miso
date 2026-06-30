"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

const ROWS = [
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
];

// Fee bar segments: portion of buyer total
// Face value ≈ 91% | service fee 1.9% ≈ 7% | Stripe ~1.5% ≈ 2% (visual weights, not exact math)
const BAR_SEGMENTS = [
  { id: "face", label: "Face value", pct: 0.88, color: "bg-ink" },
  {
    id: "service",
    label: "1.9% service",
    pct: 0.07,
    color: "bg-[hsl(var(--signal))]",
  },
  {
    id: "stripe",
    label: "Stripe",
    pct: 0.05,
    color: "bg-[hsl(var(--muted-paper))]",
  },
];

function FeeBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const prefersReduced = useReducedMotion();

  return (
    <div ref={ref} className="mt-16 max-w-2xl">
      {/* Mono eyebrow */}
      <p
        className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4"
        style={{ color: "hsl(var(--muted-paper))" }}
      >
        §&nbsp;Buyer / Organizer breakdown
      </p>

      {/* Bar */}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label="Fee breakdown: face value 88%, 1.9% service fee 7%, Stripe 5%"
      >
        {BAR_SEGMENTS.map((seg) => (
          <motion.div
            key={seg.id}
            className={`h-full origin-left ${seg.color}`}
            style={{
              width: `${seg.pct * 100}%`,
              scaleX: prefersReduced ? 1 : 0,
            }}
            animate={
              inView ? { scaleX: 1 } : { scaleX: prefersReduced ? 1 : 0 }
            }
            transition={{
              duration: prefersReduced ? 0 : 0.9,
              delay: prefersReduced ? 0 : BAR_SEGMENTS.indexOf(seg) * 0.12,
              ease: [0.22, 0.72, 0.18, 1],
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {BAR_SEGMENTS.map((seg) => (
          <span
            key={seg.id}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "hsl(var(--muted-paper))" }}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${seg.color} opacity-90`}
              aria-hidden="true"
            />
            {seg.label}
          </span>
        ))}
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "hsl(var(--muted-paper))" }}
        >
          → organizer nets ~face
        </span>
      </div>
    </div>
  );
}

export function PricingPaper() {
  const prefersReduced = useReducedMotion();
  return (
    <section className="paper-section grain border-b border-paper-hairline py-32 md:py-40">
      <div className="container">
        {/* Section index */}
        <p
          className="font-mono text-[11px] uppercase tracking-[0.22em] mb-10"
          style={{ color: "hsl(var(--muted-paper))" }}
          aria-hidden="true"
        >
          § Pricing
        </p>

        {/* Headline */}
        <motion.h2
          initial={prefersReduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{
            duration: prefersReduced ? 0 : 0.9,
            ease: [0.22, 0.72, 0.18, 1],
          }}
          className="type-section-head text-ink"
        >
          No subscription.
          <br />
          <span className="display-italic">No surprise skim.</span>
        </motion.h2>

        {/* Fee bar */}
        <FeeBar />

        {/* ROWS — giant transparent numbers */}
        <div className="mt-20 divide-y divide-paper-hairline border-t border-b border-paper-hairline">
          {ROWS.map((row, i) => (
            <motion.div
              key={row.label}
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: prefersReduced ? 0 : 0.7,
                delay: prefersReduced ? 0 : i * 0.055,
                ease: [0.22, 0.72, 0.18, 1],
              }}
              className="grid grid-cols-1 gap-2 py-8 md:grid-cols-[1fr_2fr] md:items-baseline md:gap-12"
            >
              {/* Left: kicker + value */}
              <div>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                  style={{ color: "hsl(var(--muted-paper))" }}
                >
                  {row.label}
                </p>
                <span className="display-numeric text-ink">{row.value}</span>
              </div>

              {/* Right: note */}
              <p
                className="text-sm leading-relaxed md:pt-1"
                style={{ color: "hsl(var(--muted-paper))" }}
              >
                {row.note}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
