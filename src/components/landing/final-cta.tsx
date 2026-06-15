"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { MagneticButton } from "@/components/motion/magnetic-button";
import { WordReveal } from "@/components/motion/word-reveal";

// Verbatim checklist labels — strip icons per directive
const CHECKLIST_LABELS = [
  "Storefront live in minutes — your logo, your tiers, your copy.",
  "Stripe Connect onboarding in the next step.",
  "Resale and royalties configured per-event.",
  "Offline-capable door scanning, free of charge.",
] as const;

function useLastSync() {
  const prefersReduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [prefersReduced]);

  if (prefersReduced) return "0s ago";
  if (elapsed === 0) return "just now";
  if (elapsed < 60) return `${elapsed}s ago`;
  return `${Math.floor(elapsed / 60)}m ago`;
}

export function FinalCta() {
  const prefersReduced = useReducedMotion();
  const lastSync = useLastSync();

  return (
    <section className="relative overflow-hidden border-b border-hairline bg-ink">
      {/* Faint grid reprise — single ambient layer, aria-hidden */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--paper) / 0.028) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--paper) / 0.028) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative container py-32 md:py-40">
        {/* Editorial index */}
        <p className="eyebrow mb-12" aria-hidden="true">
          § 06 / 06
        </p>

        <div className="grid gap-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* Left column — headline + body + CTAs */}
          <div>
            <WordReveal
              as="h2"
              className="type-masthead leading-[0.92] text-foreground"
              segments={[
                { text: "Publish your" },
                { break: true, text: "" },
                { text: "first event" },
                { break: true, text: "" },
                { text: "tonight.", italic: true, color: "hsl(var(--signal))" },
              ]}
            />

            <Reveal delay={0.55}>
              <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
                Create your organization, hook up Stripe Connect, design your storefront — and publish.
                No sales call required, no subscription.
              </p>
            </Reveal>

            <Reveal delay={0.7}>
              <div className="mt-9 flex flex-wrap gap-3">
                <MagneticButton>
                  <Button asChild size="lg">
                    <Link href="/signup/organizer">
                      Start free <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </MagneticButton>
                <MagneticButton strength={0.2}>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Log in</Link>
                  </Button>
                </MagneticButton>
              </div>
            </Reveal>
          </div>

          {/* Right column — mono receipt strip */}
          <Reveal delay={0.35} y={16}>
            <div className="pt-2">
              {/* Receipt heading */}
              <p className="eyebrow mb-5" aria-hidden="true">
                Included at every tier
              </p>

              {/* Single horizontal mono receipt, wraps on mobile */}
              <div
                className="flex flex-wrap items-baseline gap-x-0 gap-y-3"
                role="list"
                aria-label="What's included"
              >
                {CHECKLIST_LABELS.map((label, i) => (
                  <motion.span
                    key={label}
                    role="listitem"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-10% 0px" }}
                    transition={{
                      duration: prefersReduced ? 0 : 0.55,
                      delay: prefersReduced ? 0 : i * 0.06,
                      ease: [0.22, 0.72, 0.18, 1],
                    }}
                    className="inline-flex items-baseline"
                  >
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {label}
                    </span>
                    {i < CHECKLIST_LABELS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="mx-4 font-mono text-[11px] text-hairline-strong select-none"
                        style={{ color: "hsl(var(--hairline-strong))" }}
                      >
                        /
                      </span>
                    )}
                  </motion.span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Closing terminal status bar */}
        <Reveal delay={0.9} y={8}>
          <div
            className="mt-20 flex items-center gap-3 border-t pt-5"
            style={{ borderColor: "hsl(var(--hairline))" }}
          >
            {/* Live dot */}
            <span
              aria-hidden="true"
              className="relative flex h-2 w-2 shrink-0 items-center justify-center"
            >
              {!prefersReduced && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: "hsl(var(--signal))" }}
                />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "hsl(var(--signal))" }}
              />
            </span>

            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Last sync{" "}
              <span
                className="tabular-nums"
                style={{ color: "hsl(var(--paper))" }}
                aria-label={`Last sync: ${lastSync}`}
              >
                {lastSync}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="font-mono text-[11px] tracking-[0.18em]"
              style={{ color: "hsl(var(--hairline-strong))" }}
            >
              ·
            </span>

            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Platform status{" "}
              <span style={{ color: "hsl(var(--signal))" }}>operational</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
