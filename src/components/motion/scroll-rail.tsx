"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

export function ScrollRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 hidden w-px bg-hairline md:block"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 hidden w-px origin-top bg-signal md:block"
        style={{ scaleY }}
      />
      {children}
    </div>
  );
}
