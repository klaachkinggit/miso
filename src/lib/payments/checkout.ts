import { computeClubTablePricing } from "@/lib/payments/pricing";
import { DomainError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/service";
import type { TicketCategory } from "@/types/db";

// Shared primary-checkout helpers. The Stripe Checkout-Session flow that
// once lived here was retired with the legacy stack (ADR 0003); these
// pricing/normalization/gift helpers are still consumed by the marketplace
// path (`src/lib/stripe-marketplace/payments.ts`).

export class GiftRecipientNotFoundError extends DomainError {
  constructor() {
    super("We could not find a MISO account for that gift recipient.");
    this.name = "GiftRecipientNotFoundError";
  }
}

class ExtraGuestsInvalidError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ExtraGuestsInvalidError";
  }
}

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface CheckoutPricing {
  amount: number;
  onlineAdvanceAmount: number | null;
  minSpendingTotal: number | null;
}

export function normalizeQuantity(quantity: number | undefined): number {
  return Math.max(1, Math.min(10, Math.floor(quantity ?? 1)));
}

export function normalizeExtras(extras: number | undefined): number {
  return Math.max(0, Math.floor(extras ?? 0));
}

export function validateExtraGuests(
  category: TicketCategory,
  extras: number,
): void {
  if (extras === 0) return;

  if (category.kind !== "club_table" || !category.extra_guests_enabled) {
    throw new ExtraGuestsInvalidError(
      "This category does not allow extra guests.",
    );
  }

  const maxExtras = category.max_extra_guests ?? 0;
  if (extras > maxExtras) {
    throw new ExtraGuestsInvalidError(
      `At most ${maxExtras} extra guest(s) allowed for this table.`,
    );
  }

  if (category.price_per_extra_guest == null) {
    throw new ExtraGuestsInvalidError("Extra guest price is not configured.");
  }
}

export function checkoutPricing(
  category: TicketCategory,
  extras: number,
): CheckoutPricing {
  if (category.kind !== "club_table") {
    return {
      amount: Number(category.price),
      onlineAdvanceAmount: null,
      minSpendingTotal: null,
    };
  }

  const pricing = computeClubTablePricing(category, extras);
  return {
    amount: pricing.amount,
    onlineAdvanceAmount: pricing.onlineAdvanceAmount,
    minSpendingTotal: pricing.minSpendingTotal,
  };
}

export async function resolveGiftRecipientUserId(
  sb: ServiceClient,
  email: string | null | undefined,
): Promise<string | null> {
  if (!email) return null;

  const normalizedEmail = email.toLowerCase();
  const { data: friend } = await sb
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle<{ id: string; email: string }>();
  if (!friend) throw new GiftRecipientNotFoundError();

  return friend.id;
}
