"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { patchedQueryHref } from "@/lib/query-string";
import {
  EVENT_GENRES,
  EVENT_PRICE_BUCKETS,
  EVENT_SORTS,
  EVENT_VIBES,
  type EventDiscoveryParams,
} from "@/lib/events/discovery";

interface EventsFilterPanelProps {
  discovery: EventDiscoveryParams;
  hasActive: boolean;
  basePath?: string;
}

export function EventsFilterPanel({
  discovery,
  hasActive,
  basePath = "/events",
}: EventsFilterPanelProps) {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("filters") === "1";
  const [q, setQ] = useState(discovery.q);
  const filtersId = "event-filters-panel";

  function update(next: Record<string, string | null>) {
    router.push(patchedQueryHref(params, next, basePath));
  }

  function clearAll() {
    setQ("");
    router.push(basePath);
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <div className="relative flex-1">
          <label htmlFor="event-search" className="sr-only">
            Search events
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="event-search"
            name="q"
            type="search"
            autoComplete="off"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search events, artists, venues, cities…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="default">
          Search
        </Button>
        <Button
          type="button"
          variant={open ? "default" : "outline"}
          onClick={() => update({ filters: open ? null : "1" })}
          aria-expanded={open}
          aria-controls={filtersId}
        >
          <Filter className="mr-2 h-4 w-4" /> Filters
        </Button>
        {hasActive ? (
          <Button type="button" variant="ghost" onClick={clearAll}>
            <X className="mr-2 h-4 w-4" /> Clear filters
          </Button>
        ) : null}
      </form>

      {open ? (
        <div
          id={filtersId}
          className="grid gap-4 rounded-md border border-hairline bg-ink-raised p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FilterSelect
            label="Music style"
            name="genre"
            value={discovery.genre}
            options={EVENT_GENRES}
            onChange={(value) => update({ genre: value })}
          />
          <FilterSelect
            label="Vibe"
            name="vibe"
            value={discovery.vibe}
            options={EVENT_VIBES}
            onChange={(value) => update({ vibe: value })}
          />
          <FilterSelect
            label="Price"
            name="price"
            value={discovery.price}
            options={EVENT_PRICE_BUCKETS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
            onChange={(value) => update({ price: value })}
          />
          <FilterSelect
            label="City"
            name="city"
            value={discovery.city}
            options={[
              { value: "paris", label: "Paris" },
              { value: "berlin", label: "Berlin" },
              { value: "london", label: "London" },
              { value: "amsterdam", label: "Amsterdam" },
              { value: "casablanca", label: "Casablanca" },
              { value: "marrakech", label: "Marrakech" },
              { value: "rabat", label: "Rabat" },
            ]}
            onChange={(value) => update({ city: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="festival"
              checked={discovery.festival}
              onChange={(event) =>
                update({ festival: event.target.checked ? "1" : null })
              }
              className="h-4 w-4 rounded border-border"
            />
            Festivals only
          </label>
          <FilterSelect
            label="Sort"
            name="sort"
            value={discovery.sort}
            options={EVENT_SORTS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
            onChange={(value) => update({ sort: value || "date" })}
            clearable={false}
          />
        </div>
      ) : null}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  clearable?: boolean;
}

function FilterSelect({
  label,
  name,
  value,
  options,
  onChange,
  clearable = true,
}: FilterSelectProps) {
  return (
    <label className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-hairline bg-ink-soft/60 px-3 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
      >
        {clearable ? <option value="">Any</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
