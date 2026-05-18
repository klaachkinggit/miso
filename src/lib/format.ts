import type { Currency } from "@/types/db";

export const EVENT_TIMEZONE = "Europe/Paris";
export const APP_LOCALE = "en-GB";

export function formatPrice(amount: number | string, _currency: Currency): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return `€${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(APP_LOCALE, {
    timeZone: EVENT_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString(APP_LOCALE, {
    timeZone: EVENT_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function partsInTimezone(date: Date, tz: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
}

function tzOffsetMs(date: Date, tz: string): number {
  const parts = partsInTimezone(date, tz);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

// "YYYY-MM-DDTHH:mm" in EVENT_TIMEZONE for an ISO instant.
export function casablancaInputValue(iso: string): string {
  const date = new Date(iso);
  const parts = partsInTimezone(date, EVENT_TIMEZONE);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Parse "YYYY-MM-DDTHH:mm" as EVENT_TIMEZONE local → UTC ISO string.
export function casablancaInputToIso(value: string): string {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const naive = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0));
  const offset = tzOffsetMs(naive, EVENT_TIMEZONE);
  return new Date(naive.getTime() - offset).toISOString();
}

