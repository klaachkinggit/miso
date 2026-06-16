"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { saveOrganizationThemeAction } from "@/app/smartboard/theme-actions";
import {
  THEME_KEYS,
  THEME_PRESETS,
  type ThemeKey,
  type ThemePreset,
} from "@/lib/organizations/theme";

function previewStyle(preset: ThemePreset): CSSProperties {
  return {
    ...preset.cssVars,
    "--font-display": preset.fontPair.heading,
    "--font-sans": preset.fontPair.body,
    colorScheme: preset.colorScheme,
  } as CSSProperties;
}

function swatch(token: string) {
  return { backgroundColor: `hsl(var(${token}))` };
}

function StorefrontPreview({ preset }: { preset: ThemePreset }) {
  const heroJustify =
    preset.heroLayout === "centered"
      ? "items-center text-center"
      : preset.heroLayout === "minimal"
        ? "items-start"
        : "items-start";
  const cardLayout =
    preset.cardVariant === "ledger"
      ? "grid-cols-1"
      : preset.cardVariant === "ticket"
        ? "grid-cols-1"
        : "grid-cols-2";

  return (
    <div
      data-hero-layout={preset.heroLayout}
      data-card-variant={preset.cardVariant}
      style={previewStyle(preset)}
      className="overflow-hidden rounded-md border"
    >
      <div
        className="border-b p-5"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className={`flex flex-col gap-2 ${heroJustify}`}>
          <span
            className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
            style={{ color: "hsl(var(--accent))" }}
          >
            Official storefront
          </span>
          <span
            className="text-2xl leading-none"
            style={{
              fontFamily: "var(--font-display)",
              color: "hsl(var(--foreground))",
            }}
          >
            Aurora Live
            <span style={{ color: "hsl(var(--accent))" }}>.</span>
          </span>
          <span
            className="text-xs"
            style={{
              fontFamily: "var(--font-sans)",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Verified tickets · official resale
          </span>
        </div>
      </div>
      <div
        className={`grid ${cardLayout} gap-3 p-5`}
        style={{ background: "hsl(var(--background))" }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-md border p-3"
            style={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <div
              className={
                preset.cardVariant === "ledger"
                  ? "mb-2 h-2 w-full rounded"
                  : "mb-2 h-12 w-full rounded"
              }
              style={{ background: "hsl(var(--muted))" }}
            />
            <div
              className="text-[11px] font-medium"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              Night {i + 1}
            </div>
            <div
              className="mt-2 inline-flex rounded px-2 py-1 text-[10px] font-medium"
              style={{
                background: "hsl(var(--accent))",
                color: "hsl(var(--accent-foreground))",
              }}
            >
              From €29
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemePicker({ currentKey }: { currentKey: ThemeKey }) {
  const [selected, setSelected] = useState<ThemeKey>(currentKey);
  const preset = THEME_PRESETS[selected];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_KEYS.map((key) => {
            const p = THEME_PRESETS[key];
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={active}
                className={
                  "flex min-h-44 flex-col gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 " +
                  (active
                    ? "border-paper bg-ink-soft"
                    : "border-hairline hover:border-hairline-strong")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {p.label}
                  </span>
                  {active ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      "--background",
                      "--card",
                      "--muted",
                      "--foreground",
                      "--accent",
                    ] as const
                  ).map((token) => (
                    <span
                      key={token}
                      className="h-6 w-6 rounded-full border border-hairline"
                      style={
                        { ...p.cssVars, ...swatch(token) } as CSSProperties
                      }
                    />
                  ))}
                </div>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {p.description}
                </span>
                <span className="mt-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {p.heroLayout} hero · {p.cardVariant} cards
                </span>
              </button>
            );
          })}
        </div>

        <form action={saveOrganizationThemeAction}>
          <input type="hidden" name="theme" value={selected} />
          <Button
            type="submit"
            variant="invert"
            disabled={selected === currentKey}
          >
            {selected === currentKey
              ? "Theme applied"
              : `Apply ${preset.label}`}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <span className="eyebrow">Live preview</span>
        <p className="text-sm text-muted-foreground">{preset.bestFor}</p>
        <StorefrontPreview preset={preset} />
      </div>
    </div>
  );
}
