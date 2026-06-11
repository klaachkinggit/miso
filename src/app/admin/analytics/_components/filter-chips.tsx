"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

interface FilterOption {
  id: string;
  label: string;
}

interface FilterChipsProps {
  events: FilterOption[];
  channels: FilterOption[];
  selectedEvents: string[];
  selectedChannels: string[];
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterChips({
  events,
  channels,
  selectedEvents,
  selectedChannels,
}: FilterChipsProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const apply = (next: Record<string, string[]>) => {
    const usp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v.length === 0) usp.delete(k);
      else usp.set(k, v.join(","));
    }
    start(() => router.replace(`?${usp.toString()}`));
  };

  const hasAny = selectedEvents.length > 0 || selectedChannels.length > 0;

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      <Section
        title="Events"
        options={events}
        selected={selectedEvents}
        onToggle={(id) => apply({ events: toggle(selectedEvents, id), channels: selectedChannels })}
      />
      <Section
        title="Sales channels"
        options={channels}
        selected={selectedChannels}
        onToggle={(id) => apply({ channels: toggle(selectedChannels, id), events: selectedEvents })}
      />
      {hasAny ? (
        <button
          type="button"
          onClick={() => apply({ events: [], channels: [] })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear filters
        </button>
      ) : null}
    </div>
  );
}

function Section({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-signal/40 bg-signal/15 text-signal"
                  : "border-hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
