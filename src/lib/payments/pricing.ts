import type { TicketCategory } from "@/types/db";

// Table price doubles as minimum spending. Online advance defaults to the
// price when not configured; extras are billed per guest on top of the advance.
export function computeClubTablePricing(
  category: Pick<TicketCategory, "price" | "online_advance" | "price_per_extra_guest">,
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
