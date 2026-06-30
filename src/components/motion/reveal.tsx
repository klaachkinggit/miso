"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "span" | "li" | "ul" | "ol";
  style?: CSSProperties;
  once?: boolean;
};

export function Reveal({
  children,
  delay = 0,
  y = 28,
  duration = 0.8,
  className,
  as = "div",
  style,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-12% 0px" });
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y }}
      animate={
        reduceMotion || inView ? { opacity: 1, y: 0 } : { opacity: 0, y }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration, delay, ease: [0.22, 0.72, 0.18, 1] }
      }
      className={className}
      style={style}
    >
      {children}
    </MotionTag>
  );
}
