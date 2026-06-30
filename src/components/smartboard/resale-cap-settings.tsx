"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setResaleCapAction } from "@/app/smartboard/resale-cap-actions";

function describeCap(bps: number): string {
  if (bps <= 0) return "Face value only (no markup)";
  return `Face value + ${bps / 100}%`;
}

export function ResaleCapSettings({
  orgCapBps,
  effectiveCapBps,
  countryCode,
  countryOverride,
}: {
  orgCapBps: number;
  effectiveCapBps: number;
  countryCode: string | null;
  countryOverride: boolean;
}) {
  const [percent, setPercent] = useState((orgCapBps / 100).toString());

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/70 bg-secondary/40 px-3 py-2 text-sm">
        <p className="font-medium">
          Current effective cap: {describeCap(effectiveCapBps)}
        </p>
        {countryOverride ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Set by {countryCode} legal ceiling — overrides your organization
            default.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Using your organization default. No legal ceiling applies for{" "}
            {countryCode ?? "your country"}.
          </p>
        )}
      </div>

      <form action={setResaleCapAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="resale-cap-percent">
            Organization resale markup cap (%)
          </Label>
          <Input
            id="resale-cap-percent"
            name="resale_cap_percent"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            disabled={countryOverride}
          />
          <input
            type="hidden"
            name="resale_cap_bps"
            value={Math.round((parseFloat(percent) || 0) * 100)}
          />
          <p className="text-xs text-muted-foreground">
            0% = face value only. Applies unless a stricter legal ceiling exists
            for your country.
          </p>
        </div>
        <Button type="submit" disabled={countryOverride}>
          Save resale cap
        </Button>
      </form>
    </div>
  );
}
