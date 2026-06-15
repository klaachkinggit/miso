"use client";

import { Reveal } from "@/components/motion/reveal";

interface ManifestoProps {
  className?: string;
}

export function Manifesto({ className }: ManifestoProps) {
  return (
    <section
      className={[
        "paper-section grain py-32 md:py-40 overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="container">
        {/* Off-center single column with hairline gutter rule */}
        <div className="lg:ml-[12%] max-w-3xl border-l border-[hsl(var(--paper-hairline))] pl-8 md:pl-12">
          {/* §02 index */}
          <p
            aria-hidden
            className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[hsl(var(--muted-paper))] mb-10"
          >
            §02 / 06
          </p>

          <Reveal duration={0.9} y={24}>
            {/* The visible h2 IS the editorial statement */}
            <h2 className="type-section-head text-ink mb-8">
              Miso is the{" "}
              <span className="display-italic">infrastructure</span> your{" "}
              <span className="display-italic">organization</span> runs on —{" "}
              branded storefronts, direct{" "}
              <span style={{ color: "hsl(var(--signal))" }}>Stripe</span>{" "}
              payouts, resale with price caps, a{" "}
              <span className="display-italic">door</span> that scans offline.
            </h2>
          </Reveal>

          <Reveal duration={0.9} y={20} delay={0.1}>
            <p className="text-base leading-relaxed text-[hsl(var(--muted-paper))]">
              Not a marketplace you list on. The{" "}
              <em>billetterie</em> you own.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
