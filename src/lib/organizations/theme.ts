export type HeroLayout = "centered" | "split" | "minimal";
export type CardVariant = "poster" | "ticket" | "ledger";
export type ThemeColorScheme = "dark" | "light";
export type ThemeFontPair = { heading: string; body: string };
export type ThemePreset = {
  key: string;
  label: string;
  description: string;
  bestFor: string;
  cssVars: Record<string, string>;
  fontPair: ThemeFontPair;
  heroLayout: HeroLayout;
  cardVariant: CardVariant;
  colorScheme: ThemeColorScheme;
};

const SERIF_STACK = "Georgia, 'Times New Roman', serif";
const SANS_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";
const CONDENSED_STACK =
  "'Arial Narrow', 'Aptos Narrow', 'Helvetica Neue', Arial, sans-serif";
const DISPLAY_FONT = `var(--font-display), ${SERIF_STACK}`;
const SANS_FONT = `var(--font-sans), ${SANS_STACK}`;

export const THEME_TEMPLATE_VARIANTS = new Set<CardVariant>([
  "poster",
  "ticket",
  "ledger",
]);
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
  "--ink",
  "--ink-raised",
  "--ink-soft",
  "--ink-elevated",
  "--paper",
  "--signal",
  "--signal-soft",
  "--hairline",
  "--hairline-strong",
] as const;

type ThemeSpec = Omit<ThemePreset, "cssVars" | "fontPair"> & {
  tokens: readonly string[];
  heading?: string;
  body?: string;
};

function tokenVars(tokens: readonly string[]): Record<string, string> {
  const [
    ink,
    inkRaised,
    inkSoft,
    inkElevated,
    paper,
    paperWarm,
    signal,
    signalPressed,
    signalSoft,
    hairline,
    hairlineStrong,
    mutedInk,
    primary = paper,
    primaryForeground = ink,
    accent = signal,
    accentForeground = ink,
  ] = tokens;
  return Object.assign(
    {
      "--ink": ink,
      "--ink-raised": inkRaised,
      "--ink-soft": inkSoft,
      "--ink-elevated": inkElevated,
      "--paper": paper,
      "--paper-warm": paperWarm,
      "--signal": signal,
      "--signal-pressed": signalPressed,
      "--signal-soft": signalSoft,
      "--hairline": hairline,
      "--hairline-strong": hairlineStrong,
      "--muted-ink": mutedInk,
    },
    {
      "--background": ink,
      "--foreground": paper,
      "--card": inkRaised,
      "--card-foreground": paper,
      "--popover": inkRaised,
      "--popover-foreground": paper,
      "--primary": primary,
      "--primary-foreground": primaryForeground,
      "--secondary": inkSoft,
      "--secondary-foreground": paper,
      "--muted": inkSoft,
      "--muted-foreground": mutedInk,
      "--accent": accent,
      "--accent-foreground": accentForeground,
      "--border": hairline,
      "--input": hairline,
      "--ring": signal,
    },
  );
}

function preset({
  tokens,
  heading = DISPLAY_FONT,
  body = SANS_FONT,
  ...theme
}: ThemeSpec): ThemePreset {
  return { ...theme, cssVars: tokenVars(tokens), fontPair: { heading, body } };
}

const ink = preset({
  key: "ink",
  label: "Ink house",
  description:
    "A dark editorial ticket office with sharp contrast, warm stock typography, and poster-first event cards.",
  bestFor: "Clubs, night programs, and serious multi-event organizers.",
  tokens: [
    "240 5% 6%",
    "240 5% 9%",
    "240 5% 12%",
    "240 5% 15%",
    "38 24% 92%",
    "38 24% 88%",
    "14 100% 60%",
    "14 100% 52%",
    "14 100% 92%",
    "240 5% 18%",
    "240 5% 28%",
    "240 4% 64%",
  ],
  heroLayout: "centered",
  cardVariant: "poster",
  colorScheme: "dark",
});

const aurora = preset({
  key: "aurora",
  label: "Aurora stage",
  description:
    "A cool stage-light template with cyan signal color, deep teal surfaces, and ticket-strip event cards.",
  bestFor: "Electronic nights, live shows, showcases, and late-night venues.",
  tokens: [
    "200 38% 7%",
    "200 32% 11%",
    "200 26% 15%",
    "200 28% 18%",
    "180 30% 94%",
    "180 24% 90%",
    "168 78% 52%",
    "168 78% 44%",
    "168 60% 90%",
    "200 24% 19%",
    "190 30% 32%",
    "195 14% 66%",
    "168 78% 52%",
  ],
  heroLayout: "split",
  cardVariant: "ticket",
  colorScheme: "dark",
});

const sunset = preset({
  key: "sunset",
  label: "Sunset room",
  description:
    "A warm plum and amber design with a softer centered hero and gallery-like browsing rhythm.",
  bestFor:
    "Restaurants, lounges, cultural evenings, and premium social events.",
  tokens: [
    "320 16% 8%",
    "320 14% 12%",
    "320 12% 16%",
    "320 12% 20%",
    "34 36% 93%",
    "34 36% 88%",
    "20 96% 62%",
    "20 96% 54%",
    "20 90% 92%",
    "320 12% 20%",
    "330 16% 32%",
    "330 8% 66%",
  ],
  heroLayout: "centered",
  cardVariant: "poster",
  colorScheme: "dark",
});

const mono = preset({
  key: "mono",
  label: "Mono ledger",
  description:
    "A near-monochrome listing system with stripped-back surfaces, tabular details, and no decorative color dependency.",
  bestFor: "Conferences, talks, member clubs, and information-heavy programs.",
  tokens: [
    "0 0% 7%",
    "0 0% 10%",
    "0 0% 14%",
    "0 0% 18%",
    "0 0% 96%",
    "0 0% 92%",
    "0 0% 96%",
    "0 0% 84%",
    "0 0% 24%",
    "0 0% 20%",
    "0 0% 34%",
    "0 0% 64%",
  ],
  heading: `var(--font-mono), ${MONO_STACK}`,
  heroLayout: "minimal",
  cardVariant: "ledger",
  colorScheme: "dark",
});

const gallery = preset({
  key: "gallery",
  label: "Gallery white",
  description:
    "A bright editorial storefront with off-white walls, black type, and image-led event browsing.",
  bestFor:
    "Art spaces, fashion drops, day festivals, workshops, and cultural venues.",
  tokens: [
    "42 38% 96%",
    "42 36% 92%",
    "42 30% 88%",
    "42 32% 86%",
    "230 16% 8%",
    "230 12% 14%",
    "346 82% 50%",
    "346 82% 42%",
    "346 70% 92%",
    "42 16% 76%",
    "42 12% 58%",
    "230 8% 38%",
  ],
  heroLayout: "split",
  cardVariant: "poster",
  colorScheme: "light",
});

const festival = preset({
  key: "festival",
  label: "Festival index",
  description:
    "A high-energy public program with acid signal color, compressed headlines, and fast-scanning ticket tiles.",
  bestFor: "Festivals, pop-ups, multi-stage programs, and youth-facing events.",
  tokens: [
    "250 18% 8%",
    "250 16% 12%",
    "250 14% 16%",
    "250 14% 20%",
    "78 86% 88%",
    "54 92% 88%",
    "78 92% 58%",
    "78 86% 48%",
    "78 86% 90%",
    "250 12% 22%",
    "252 16% 36%",
    "252 8% 68%",
    "78 92% 58%",
  ],
  heading: CONDENSED_STACK,
  heroLayout: "split",
  cardVariant: "ticket",
  colorScheme: "dark",
});

export const THEME_PRESETS = {
  ink,
  aurora,
  sunset,
  mono,
  gallery,
  festival,
} as const;
export type ThemeKey = keyof typeof THEME_PRESETS;
export const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
export const DEFAULT_THEME_KEY: ThemeKey = "ink";

export function isValidThemeKey(key: unknown): key is ThemeKey {
  return (
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(THEME_PRESETS, key)
  );
}

export function getTheme(themeJson: unknown): ThemePreset {
  if (themeJson && typeof themeJson === "object" && !Array.isArray(themeJson)) {
    const preset = (themeJson as Record<string, unknown>).preset;
    if (isValidThemeKey(preset)) return THEME_PRESETS[preset];
  }
  return THEME_PRESETS[DEFAULT_THEME_KEY];
}

export function themeJson(key: ThemeKey): { preset: ThemeKey } {
  return { preset: key };
}
