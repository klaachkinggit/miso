"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_GENRES, EVENT_VIBES } from "@/lib/events/discovery";
import type { EventRow } from "@/types/db";

interface DiscoveryFieldsProps {
  event?: Pick<EventRow, "genre" | "vibe" | "is_festival" | "artists">;
}

export function DiscoveryFields({ event }: DiscoveryFieldsProps) {
  return (
    <div className="grid gap-5 rounded-md border border-border/60 bg-background/30 p-4">
      <div>
        <p className="text-sm font-medium text-foreground/90">Discovery filters</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Powers public search, filter chips, and popular event browsing.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <Label htmlFor="genre">Music style</Label>
          <select
            id="genre"
            name="genre"
            defaultValue={event?.genre ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Unspecified</option>
            {EVENT_GENRES.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <Label htmlFor="vibe">Vibe</Label>
          <select
            id="vibe"
            name="vibe"
            defaultValue={event?.vibe ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Unspecified</option>
            {EVENT_VIBES.map((vibe) => (
              <option key={vibe.value} value={vibe.value}>
                {vibe.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            name="is_festival"
            defaultChecked={event?.is_festival ?? false}
            className="h-4 w-4 rounded border-border"
          />
          Festival event
        </label>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="artists">Artists</Label>
        <Textarea
          id="artists"
          name="artists"
          rows={3}
          defaultValue={(event?.artists ?? []).join(", ")}
          placeholder="One per line, or comma-separated"
        />
      </div>
    </div>
  );
}
