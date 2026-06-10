"use client";

import { motion } from "motion/react";

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

export function PricingPaper() {
  return (
    <section className="paper-section border-b border-paper-hairline">
      <div className="container py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.45fr_0.55fr] lg:items-end lg:gap-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.7 }}
              className="eyebrow"
              style={{ color: "hsl(var(--muted-paper))" }}
            >
              Pricing
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 0.72, 0.18, 1] }}
              className="display mt-6 text-4xl text-ink md:text-6xl"
            >
              No subscription.
              <br />
              <span className="display-italic">No surprise skim.</span>
            </motion.h2>
          </div>
          <div className="space-y-px overflow-hidden rounded-md border border-paper-hairline bg-paper-hairline">
            {ROWS.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.08,
                  ease: [0.22, 0.72, 0.18, 1],
                }}
                className="grid gap-2 bg-paper px-5 py-5 md:grid-cols-[auto_1fr] md:items-center md:gap-8"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-paper))]">
                    {row.label}
                  </span>
                  <span className="display text-2xl text-ink">{row.value}</span>
                </div>
                <p className="text-sm text-[hsl(var(--muted-paper))]">{row.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
