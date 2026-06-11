"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PRESETS: Array<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All time" },
];

interface RangePickerProps {
  current: string;
  compare: "prior" | "none";
}

export function RangePicker({ current, compare }: RangePickerProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (next: Record<string, string | null>) => {
    const usp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) usp.delete(k);
      else usp.set(k, v);
    }
    start(() => router.replace(`?${usp.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`flex flex-wrap gap-1 rounded-md border border-hairline bg-ink-raised p-1 ${pending ? "opacity-70" : ""}`}
      >
        {PRESETS.map((preset) => {
          const active = current === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() =>
                update({ range: preset.value, from: null, to: null })
              }
              className={`rounded px-3 py-1 text-xs transition-colors ${
                active ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => update({ compare: compare === "prior" ? "none" : "prior" })}
        className={`rounded-md border border-hairline px-3 py-1 text-xs transition-colors ${
          compare === "prior"
            ? "border-signal/40 bg-signal/10 text-signal"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Compare to prior period
      </button>
    </div>
  );
}
