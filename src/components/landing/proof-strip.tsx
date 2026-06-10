"use client";

import { motion } from "motion/react";

const ITEMS = [
  "200+ organizers",
  "€4.2M paid out",
  "0 scalping markup",
  "31 EU cities",
  "Stripe Connect",
  "Base Sepolia",
  "Offline scanning",
  "Anti-scalping resale",
];

export function ProofStrip() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <section className="border-b border-hairline bg-ink">
      <div className="relative overflow-hidden py-6">
        <div className="container mb-4 flex items-center justify-between gap-6">
          <p className="eyebrow">Powering organizers across Europe</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Live network
          </span>
        </div>
        <motion.div
          aria-hidden
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
          className="flex w-max items-center gap-12 whitespace-nowrap px-6"
        >
          {loop.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex items-center gap-12 text-sm text-muted-foreground"
            >
              {item}
              <span aria-hidden className="h-1 w-1 rounded-full bg-signal" />
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
