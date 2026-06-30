"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { Fragment, useRef, type CSSProperties, type ElementType } from "react";

type Segment = {
  text: string;
  italic?: boolean;
  color?: string;
  break?: boolean;
};

export function WordReveal({
  segments,
  className,
  style,
  stagger = 0.045,
  duration = 0.9,
  as,
}: {
  segments: Segment[];
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  duration?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduceMotion = useReducedMotion();
  const Wrapper = (as ?? "div") as ElementType;

  const words: { word: string; segment: Segment }[] = [];
  segments.forEach((seg) => {
    if (seg.break) {
      words.push({ word: "\n", segment: seg });
      return;
    }
    seg.text.split(" ").forEach((w) => {
      if (w) words.push({ word: w, segment: seg });
    });
  });

  let idx = -1;
  return (
    <Wrapper ref={ref} className={className} style={style}>
      {words.map((entry, i) => {
        if (entry.word === "\n") return <br key={`br-${i}`} />;
        idx += 1;
        const wordIdx = idx;
        return (
          <Fragment key={`w-${i}`}>
            <span
              style={{
                display: "inline-block",
                overflow: "hidden",
                verticalAlign: "bottom",
              }}
            >
              <motion.span
                initial={reduceMotion ? false : { y: "100%", opacity: 0 }}
                animate={
                  reduceMotion || inView
                    ? { y: 0, opacity: 1 }
                    : { y: "100%", opacity: 0 }
                }
                transition={{
                  duration: reduceMotion ? 0 : duration,
                  delay: reduceMotion ? 0 : wordIdx * stagger,
                  ease: [0.22, 0.72, 0.18, 1],
                }}
                style={{
                  display: "inline-block",
                  fontStyle: entry.segment.italic ? "italic" : undefined,
                  color: entry.segment.color,
                  fontFamily: entry.segment.italic
                    ? "var(--font-display)"
                    : undefined,
                }}
              >
                {entry.word}
              </motion.span>
            </span>{" "}
          </Fragment>
        );
      })}
    </Wrapper>
  );
}
