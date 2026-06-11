"use client";

import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { AnalyticsTimeBucket } from "@/lib/analytics/organization";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types/db";

interface RevenueChartProps {
  series: AnalyticsTimeBucket[];
  currency: Currency;
}

const WIDTH = 800;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

function niceTick(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / pow;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * pow;
}

export function RevenueChart({ series, currency }: RevenueChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, ticks } = useMemo(() => {
    const innerW = WIDTH - PADDING.left - PADDING.right;
    const innerH = HEIGHT - PADDING.top - PADDING.bottom;
    const maxValue = Math.max(1, ...series.map((b) => b.revenue));
    const niceMax = niceTick(maxValue);
    const xScale = (i: number) =>
      PADDING.left + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const yScale = (v: number) => PADDING.top + innerH - (v / niceMax) * innerH;
    const points = series.map((b, i) => ({ x: xScale(i), y: yScale(b.revenue), bucket: b }));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ value: niceMax * p, y: yScale(niceMax * p) }));
    return { points, ticks };
  }, [series]);

  if (series.length === 0) return null;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x.toFixed(2)} ${HEIGHT - PADDING.bottom} L ${points[0].x.toFixed(2)} ${HEIGHT - PADDING.bottom} Z`;

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const hover = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Revenue over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={tick.y}
              y2={tick.y}
              stroke="hsl(var(--hairline))"
              strokeDasharray="2 4"
            />
            <text
              x={PADDING.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
            >
              {formatPrice(Math.round(tick.value), currency)}
            </text>
          </g>
        ))}
        <motion.path
          d={area}
          fill="hsl(var(--signal) / 0.12)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="hsl(var(--signal))"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        {hover ? (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="hsl(var(--signal))"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <circle cx={hover.x} cy={hover.y} r={4} fill="hsl(var(--signal))" />
          </g>
        ) : null}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none absolute rounded-md border border-hairline bg-ink-raised px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hover.x / WIDTH) * 100}%`,
            top: 4,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium text-foreground">{formatPrice(hover.bucket.revenue, currency)}</div>
          <div className="text-muted-foreground">
            {hover.bucket.tickets} tickets · {hover.bucket.bucket}
          </div>
        </div>
      ) : null}
    </div>
  );
}
