import type { Currency } from "@/types/db";

export const EVENT_TIMEZONE = "Africa/Casablanca";

export function formatPrice(amount: number | string, currency: Currency): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (currency === "EUR") {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
  }
  // MAD
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} MAD`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: EVENT_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
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

export function shortAddress(addr: string | null | undefined, edge = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, edge)}…${addr.slice(-edge)}`;
}

export function explorerUrl(
  kind: "address" | "tx",
  value: string,
  cluster: string = "devnet"
): string {
  const base = process.env.NEXT_PUBLIC_SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const path = kind === "address" ? "address" : "tx";
  return `${base}/${path}/${value}?cluster=${cluster}`;
}
