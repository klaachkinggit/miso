import {
  computePriorRange,
  rangePresetWindow,
  type AnalyticsFilters,
  type AnalyticsRange,
  type AnalyticsRangePreset,
} from "@/lib/analytics/organization";

const KNOWN_PRESETS: AnalyticsRangePreset[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "ytd",
  "all",
  "custom",
];

export interface AnalyticsSearchParams {
  range: AnalyticsRange;
  prior: AnalyticsRange | null;
  compare: "prior" | "none";
  filters: AnalyticsFilters;
}

function parsePreset(raw: string | undefined): AnalyticsRangePreset {
  if (raw && (KNOWN_PRESETS as string[]).includes(raw)) return raw as AnalyticsRangePreset;
  return "30d";
}

function parseCsv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

export function parseAnalyticsSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): AnalyticsSearchParams {
  const rawRange = typeof searchParams.range === "string" ? searchParams.range : undefined;
  const preset = parsePreset(rawRange);

  let range: AnalyticsRange;
  if (preset === "custom") {
    const fromRaw = typeof searchParams.from === "string" ? searchParams.from : undefined;
    const toRaw = typeof searchParams.to === "string" ? searchParams.to : undefined;
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 86_400_000);
    const to = toRaw ? new Date(toRaw) : now;
    range = { preset: "custom", from, to };
  } else {
    range = rangePresetWindow(preset, now);
  }

  const compareRaw = typeof searchParams.compare === "string" ? searchParams.compare : undefined;
  const compare: "prior" | "none" = compareRaw === "none" ? "none" : "prior";
  const prior = compare === "prior" ? computePriorRange(range) : null;

  const filters: AnalyticsFilters = {
    eventIds: parseCsv(typeof searchParams.events === "string" ? searchParams.events : undefined),
    salesChannels: parseCsv(typeof searchParams.channels === "string" ? searchParams.channels : undefined),
    categoryIds: parseCsv(typeof searchParams.categories === "string" ? searchParams.categories : undefined),
  };

  return { range, prior, compare, filters };
}
