import type { TicketCategory } from "@/types/db";

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function envNumber(name: string, fallback: string): number {
  const envValue =
    typeof process !== "undefined" ? process.env?.[name] : undefined;
  const value = Number(envValue ?? fallback);
  return Number.isFinite(value) ? value : Number(fallback);
}

// Table price doubles as minimum spending. Online advance defaults to the
// price when not configured; extras are billed per guest on top of the advance.
export function computeClubTablePricing(
  category: Pick<
    TicketCategory,
    "price" | "online_advance" | "price_per_extra_guest"
  >,
  extras: number,
): { amount: number; onlineAdvanceAmount: number; minSpendingTotal: number } {
  const advance = Number(category.online_advance ?? category.price);
  const extraPrice = Number(category.price_per_extra_guest ?? 0);
  const amount = advance + extras * extraPrice;
  return {
    amount,
    onlineAdvanceAmount: amount,
    minSpendingTotal: Number(category.price),
  };
}

export function stripeProcessingFeeForBuyerTotal(
  amountBeforeStripeFee: number,
): number {
  if (amountBeforeStripeFee <= 0) return 0;
  const percent = Math.max(0, envNumber("MISO_STRIPE_FEE_PERCENT", "1.5"));
  const fixed = Math.max(0, envNumber("MISO_STRIPE_FEE_FIXED", "0.25"));
  const rate = percent / 100;
  if (rate >= 1) return 0;
  const gross = (amountBeforeStripeFee + fixed) / (1 - rate);
  return money(gross - amountBeforeStripeFee);
}

export function allocateMoney(total: number, count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / safeCount);
  const remainder = totalCents - base * safeCount;
  return Array.from(
    { length: safeCount },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100,
  );
}
