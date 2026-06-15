"use client";

import { motion, useReducedMotion } from "motion/react";

const ITEMS = [
  { value: "200+", unit: "organizers" },
  { value: "€4.2M", unit: "paid out" },
  { value: "0%", unit: "scalping markup" },
  { value: "31", unit: "EU cities" },
  { value: "T+1", unit: "payouts" },
  { value: "On-chain", unit: "tickets" },
];

export function ProofStrip() {
  const prefersReducedMotion = useReducedMotion();
  const loop = [...ITEMS, ...ITEMS];

  return (
    <section className="border-t border-b border-hairline bg-ink">
      {/* Full-bleed: no container wrapper so the strip bleeds edge-to-edge */}
      <div className="flex items-stretch">
        {/* Pinned cartouche — stays fixed while the track scrolls */}
        <div
          className="ticker-cartouche shrink-0 flex items-center px-4 py-5 z-10"
          aria-label="Live network stats"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="ticker-mark"
            />
            LIVE&nbsp;NETWORK
          </span>
        </div>

        {/* Hairline separator between cartouche and track */}
        <div className="w-px bg-hairline shrink-0" aria-hidden />

        {/* Scrolling track — masked at both edges */}
        <div className="flex-1 overflow-hidden mask-fade-x" aria-hidden>
          <motion.div
            animate={prefersReducedMotion ? false : { x: ["0%", "-50%"] }}
            transition={{
              duration: 42,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex w-max items-center gap-0 whitespace-nowrap"
          >
            {loop.map((item, i) => (
              <span
                key={`${item.value}-${i}`}
                className="flex items-center"
              >
                {/* Value / unit pair */}
                <span className="flex items-baseline gap-1.5 px-8 py-5">
                  <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                    {item.value}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {item.unit}
                  </span>
                </span>
                {/* Separator dot */}
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full bg-hairline-strong shrink-0"
                />
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
