import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  current?: number;
  prior?: number | null;
  invertDelta?: boolean;
}

function formatDelta(
  current: number,
  prior: number,
): { text: string; direction: "up" | "down" | "flat" } {
  if (prior === 0) {
    if (current === 0) return { text: "—", direction: "flat" };
    return { text: "new", direction: "up" };
  }
  const pct = (current - prior) / prior;
  if (Math.abs(pct) < 0.005) return { text: "0%", direction: "flat" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${Math.round(pct * 100)}%`,
    direction: pct > 0 ? "up" : "down",
  };
}

export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  current,
  prior,
  invertDelta,
}: KpiTileProps) {
  const hasDelta = typeof current === "number" && typeof prior === "number";
  const delta = hasDelta ? formatDelta(current!, prior!) : null;
  const goodUp = !invertDelta;
  const deltaToneClass = !delta
    ? ""
    : delta.direction === "flat"
      ? "text-muted-foreground"
      : (delta.direction === "up") === goodUp
        ? "text-signal"
        : "text-destructive";
  const DeltaIcon =
    delta?.direction === "up"
      ? ArrowUpRight
      : delta?.direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <div className="flex flex-col gap-3 bg-ink-raised p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        {delta ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${deltaToneClass}`}
          >
            <DeltaIcon className="h-3 w-3" />
            {delta.text}
          </span>
        ) : null}
      </div>
      <div className="display text-3xl text-foreground">{value}</div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
