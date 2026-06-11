"use client";

import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { type ReactNode } from "react";

export function SpotlightCard({
  children,
  className,
  glow = "hsl(var(--signal) / 0.18)",
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, ${glow}, transparent 60%)`;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }

  return (
    <div onMouseMove={onMove} className={`group relative isolate overflow-hidden ${className ?? ""}`}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      {children}
    </div>
  );
}
