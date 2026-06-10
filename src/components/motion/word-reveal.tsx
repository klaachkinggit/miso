"use client";

import { motion, useInView } from "motion/react";
import { Fragment, useRef, type CSSProperties, type ReactNode } from "react";

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
}: {
  segments: Segment[];
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });

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
    <div ref={ref} className={className} style={style}>
      {words.map((entry, i) => {
        if (entry.word === "\n") return <br key={`br-${i}`} />;
        idx += 1;
        const wordIdx = idx;
        return (
          <Fragment key={`w-${i}`}>
            <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
              <motion.span
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0 }}
                transition={{
                  duration,
                  delay: wordIdx * stagger,
                  ease: [0.22, 0.72, 0.18, 1],
                }}
                style={{
                  display: "inline-block",
                  fontStyle: entry.segment.italic ? "italic" : undefined,
                  color: entry.segment.color,
                  fontFamily: entry.segment.italic ? "var(--font-display)" : undefined,
                }}
              >
                {entry.word}
              </motion.span>
            </span>
            {" "}
          </Fragment>
        );
      })}
    </div>
  );
}

export function SimpleWordReveal({
  text,
  className,
  delay = 0,
  stagger = 0.04,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const words = text.split(" ");
  return (
    <div ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
          <motion.span
            initial={{ y: "100%", opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0 }}
            transition={{ duration: 0.7, delay: delay + i * stagger, ease: [0.22, 0.72, 0.18, 1] }}
            style={{ display: "inline-block" }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </div>
  );
}
