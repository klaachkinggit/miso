// Storefront themes (P1.5). A *closed*, curated set of presets — never interpolate
// arbitrary user CSS. Token values are HSL triplets (e.g. "240 5% 6%") so they slot
// directly into the `hsl(var(--token))` Tailwind tokens defined in globals.css.

export type HeroLayout = "centered" | "split" | "minimal";

export type ThemeFontPair = {
  // Font-family stacks bound to the global --font-* vars set by the root layout,
  // each falling through to a system/offline-safe stack. No external fetch.
  heading: string;
  body: string;
};

export type ThemePreset = {
  key: string;
  label: string;
  cssVars: Record<string, string>;
  fontPair: ThemeFontPair;
  heroLayout: HeroLayout;
};

const SERIF_STACK = "Georgia, 'Times New Roman', serif";
const SANS_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

// Required token keys every preset must define — keeps presets coherent with the
// tokens the storefront/tailwind consume and is asserted by the test suite.
export const REQUIRED_THEME_TOKENS = [
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--accent",
  "--accent-foreground",
  "--card",
  "--card-foreground",
  "--border",
  "--muted",
  "--muted-foreground",
  // storefront uses these brand aliases directly (bg-ink-raised, border-hairline, etc.)
  "--ink",
  "--ink-raised",
  "--hairline",
  "--hairline-strong",
] as const;

// "ink" — the existing default dark design language (mirrors globals.css :root).
const ink: ThemePreset = {
  key: "ink",
  label: "Ink",
  cssVars: {
    "--ink": "240 5% 6%",
    "--ink-raised": "240 5% 9%",
    "--ink-soft": "240 5% 12%",
    "--paper": "38 24% 92%",
    "--paper-warm": "38 24% 88%",
    "--signal": "14 100% 60%",
    "--signal-pressed": "14 100% 52%",
    "--signal-soft": "14 100% 92%",
    "--hairline": "240 5% 18%",
    "--hairline-strong": "240 5% 28%",
    "--muted-ink": "240 4% 64%",
    "--background": "240 5% 6%",
    "--foreground": "38 24% 92%",
    "--card": "240 5% 9%",
    "--card-foreground": "38 24% 92%",
    "--popover": "240 5% 9%",
    "--popover-foreground": "38 24% 92%",
    "--primary": "38 24% 92%",
    "--primary-foreground": "240 5% 6%",
    "--secondary": "240 5% 12%",
    "--secondary-foreground": "38 24% 92%",
    "--muted": "240 5% 12%",
    "--muted-foreground": "240 4% 64%",
    "--accent": "14 100% 60%",
    "--accent-foreground": "240 5% 6%",
    "--border": "240 5% 18%",
    "--input": "240 5% 18%",
    "--ring": "14 100% 60%",
  },
  fontPair: {
    heading: `var(--font-display), ${SERIF_STACK}`,
    body: `var(--font-sans), ${SANS_STACK}`,
  },
  heroLayout: "centered",
};

// "aurora" — deep blue-green night with an icy cyan signal.
const aurora: ThemePreset = {
  key: "aurora",
  label: "Aurora",
  cssVars: {
    "--ink": "200 38% 7%",
    "--ink-raised": "200 32% 11%",
    "--ink-soft": "200 26% 15%",
    "--paper": "180 30% 94%",
    "--paper-warm": "180 24% 90%",
    "--signal": "168 78% 52%",
    "--signal-pressed": "168 78% 44%",
    "--signal-soft": "168 60% 90%",
    "--hairline": "200 24% 19%",
    "--hairline-strong": "190 30% 32%",
    "--muted-ink": "195 14% 66%",
    "--background": "200 38% 7%",
    "--foreground": "180 30% 94%",
    "--card": "200 32% 11%",
    "--card-foreground": "180 30% 94%",
    "--popover": "200 32% 11%",
    "--popover-foreground": "180 30% 94%",
    "--primary": "168 78% 52%",
    "--primary-foreground": "200 38% 7%",
    "--secondary": "200 26% 15%",
    "--secondary-foreground": "180 30% 94%",
    "--muted": "200 26% 15%",
    "--muted-foreground": "195 14% 66%",
    "--accent": "168 78% 52%",
    "--accent-foreground": "200 38% 7%",
    "--border": "200 24% 19%",
    "--input": "200 24% 19%",
    "--ring": "168 78% 52%",
  },
  fontPair: {
    heading: `var(--font-display), ${SERIF_STACK}`,
    body: `var(--font-sans), ${SANS_STACK}`,
  },
  heroLayout: "split",
};

// "sunset" — warm plum-charcoal with a coral-amber signal.
const sunset: ThemePreset = {
  key: "sunset",
  label: "Sunset",
  cssVars: {
    "--ink": "320 16% 8%",
    "--ink-raised": "320 14% 12%",
    "--ink-soft": "320 12% 16%",
    "--paper": "34 36% 93%",
    "--paper-warm": "34 36% 88%",
    "--signal": "20 96% 62%",
    "--signal-pressed": "20 96% 54%",
    "--signal-soft": "20 90% 92%",
    "--hairline": "320 12% 20%",
    "--hairline-strong": "330 16% 32%",
    "--muted-ink": "330 8% 66%",
    "--background": "320 16% 8%",
    "--foreground": "34 36% 93%",
    "--card": "320 14% 12%",
    "--card-foreground": "34 36% 93%",
    "--popover": "320 14% 12%",
    "--popover-foreground": "34 36% 93%",
    "--primary": "34 36% 93%",
    "--primary-foreground": "320 16% 8%",
    "--secondary": "320 12% 16%",
    "--secondary-foreground": "34 36% 93%",
    "--muted": "320 12% 16%",
    "--muted-foreground": "330 8% 66%",
    "--accent": "20 96% 62%",
    "--accent-foreground": "320 16% 8%",
    "--border": "320 12% 20%",
    "--input": "320 12% 20%",
    "--ring": "20 96% 62%",
  },
  fontPair: {
    heading: `var(--font-display), ${SERIF_STACK}`,
    body: `var(--font-sans), ${SANS_STACK}`,
  },
  heroLayout: "centered",
};

// "mono" — neutral high-contrast graphite. Mono headings, no chromatic signal.
const mono: ThemePreset = {
  key: "mono",
  label: "Mono",
  cssVars: {
    "--ink": "0 0% 7%",
    "--ink-raised": "0 0% 10%",
    "--ink-soft": "0 0% 14%",
    "--paper": "0 0% 96%",
    "--paper-warm": "0 0% 92%",
    "--signal": "0 0% 96%",
    "--signal-pressed": "0 0% 84%",
    "--signal-soft": "0 0% 24%",
    "--hairline": "0 0% 20%",
    "--hairline-strong": "0 0% 34%",
    "--muted-ink": "0 0% 64%",
    "--background": "0 0% 7%",
    "--foreground": "0 0% 96%",
    "--card": "0 0% 10%",
    "--card-foreground": "0 0% 96%",
    "--popover": "0 0% 10%",
    "--popover-foreground": "0 0% 96%",
    "--primary": "0 0% 96%",
    "--primary-foreground": "0 0% 7%",
    "--secondary": "0 0% 14%",
    "--secondary-foreground": "0 0% 96%",
    "--muted": "0 0% 14%",
    "--muted-foreground": "0 0% 64%",
    "--accent": "0 0% 96%",
    "--accent-foreground": "0 0% 7%",
    "--border": "0 0% 20%",
    "--input": "0 0% 20%",
    "--ring": "0 0% 96%",
  },
  fontPair: {
    heading: `var(--font-mono), ${MONO_STACK}`,
    body: `var(--font-sans), ${SANS_STACK}`,
  },
  heroLayout: "minimal",
};

export const THEME_PRESETS = { ink, aurora, sunset, mono } as const;

export type ThemeKey = keyof typeof THEME_PRESETS;

export const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];

export const DEFAULT_THEME_KEY: ThemeKey = "ink";

export function isValidThemeKey(key: unknown): key is ThemeKey {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(THEME_PRESETS, key);
}

// Resolves stored `{ preset: key }` to a preset, falling back to the default on
// null/unknown/garbage. The stored value is never trusted as CSS — only the key
// is read, and only to index the closed preset set.
export function getTheme(themeJson: unknown): ThemePreset {
  if (themeJson && typeof themeJson === "object" && !Array.isArray(themeJson)) {
    const preset = (themeJson as Record<string, unknown>).preset;
    if (isValidThemeKey(preset)) return THEME_PRESETS[preset];
  }
  return THEME_PRESETS[DEFAULT_THEME_KEY];
}

// Canonical persisted shape for organizations.theme.
export function themeJson(key: ThemeKey): { preset: ThemeKey } {
  return { preset: key };
}
