import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { StripeMarketplaceError } from "@/lib/stripe-marketplace/errors";
import { MIN_GROSS_CENTS } from "@/lib/stripe-marketplace/payments";
import type { PromoCode } from "@/types/db";

export interface PromoPricing {
  promoCodeId: string;
  discountCents: number;
}

// Escapes Postgres LIKE/ILIKE metacharacters (\, %, _) so a user-supplied
// string is matched as a literal. PostgREST's default escape char is backslash.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Loads the active promo for an org (case-insensitive), checks its window +
// usage, then prices the discount against the gross. The discount is CLAMPED
// so the discounted gross stays >= MIN_GROSS_CENTS — a promo may never zero or
// invert the buyer total. If even the clamped discount cannot leave a settleable
// gross, the promo is rejected as not applicable to this amount.
export async function validateAndPricePromo(params: {
  code: string;
  organizationId: string;
  grossCents: number;
}): Promise<PromoPricing> {
  const sb = createServiceClient();
  const code = params.code.trim();
  if (!code) throw new StripeMarketplaceError("Promo code is invalid.", 400);

  // ilike keeps case-insensitivity (the only reason we don't use eq), but the
  // buyer-supplied code must be matched LITERALLY: escape LIKE metacharacters
  // so a stored code like `SUMMER_20` or `50%OFF` cannot turn into a pattern
  // that mis-resolves to a different code or matches multiple rows.
  const { data, error } = await sb
    .from("promo_codes")
    .select("*")
    .eq("organization_id", params.organizationId)
    .ilike("code", escapeLikePattern(code))
    .maybeSingle<PromoCode>();
  if (error) throw error;
  if (!data) throw new StripeMarketplaceError("Promo code not found.", 400);
  if (!data.active) throw new StripeMarketplaceError("Promo code is no longer active.", 400);

  const now = Date.now();
  if (data.starts_at && now < new Date(data.starts_at).getTime()) {
    throw new StripeMarketplaceError("Promo code is not active yet.", 400);
  }
  if (data.ends_at && now > new Date(data.ends_at).getTime()) {
    throw new StripeMarketplaceError("Promo code has expired.", 400);
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    throw new StripeMarketplaceError("Promo code has reached its usage limit.", 400);
  }

  const nominal =
    data.discount_kind === "percent"
      ? Math.floor((params.grossCents * (data.percent_off ?? 0)) / 100)
      : Math.min(data.amount_off_cents ?? 0, params.grossCents);

  // Never let a promo zero/invert the total. The most we can discount and still
  // settle is grossCents - MIN_GROSS_CENTS.
  const maxDiscount = params.grossCents - MIN_GROSS_CENTS;
  if (maxDiscount <= 0) {
    throw new StripeMarketplaceError(
      "Promo code cannot be applied to this amount.",
      400,
    );
  }
  const discountCents = Math.min(nominal, maxDiscount);
  if (discountCents <= 0) {
    throw new StripeMarketplaceError(
      "Promo code cannot be applied to this amount.",
      400,
    );
  }

  return { promoCodeId: data.id, discountCents };
}

// Atomic conditional increment. Returns true when this call consumed a use;
// false when the code was already exhausted (race-safe — the WHERE guard means
// concurrent checkouts cannot both claim the last use).
export async function markPromoUsed(promoCodeId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("increment_promo_use", {
    promo_id: promoCodeId,
  });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

// Compensating release for a use consumed by markPromoUsed when the checkout
// that consumed it aborts before the charge is created. Floored at 0 in the
// RPC so it is safe to call defensively.
export async function releasePromoUse(promoCodeId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.rpc("decrement_promo_use", {
    promo_id: promoCodeId,
  });
  if (error) throw error;
}

export async function createPromoCode(params: {
  organizationId: string;
  code: string;
  discountKind: "percent" | "fixed";
  percentOff?: number | null;
  amountOffCents?: number | null;
  maxUses?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<PromoCode> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("promo_codes")
    .insert({
      organization_id: params.organizationId,
      code: params.code.trim(),
      discount_kind: params.discountKind,
      percent_off: params.discountKind === "percent" ? params.percentOff : null,
      amount_off_cents:
        params.discountKind === "fixed" ? params.amountOffCents : null,
      max_uses: params.maxUses ?? null,
      starts_at: params.startsAt ?? null,
      ends_at: params.endsAt ?? null,
    })
    .select("*")
    .single<PromoCode>();
  if (error) throw error;
  return data;
}

export async function listPromoCodes(organizationId: string): Promise<PromoCode[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("promo_codes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<PromoCode[]>();
  if (error) throw error;
  return data ?? [];
}

export async function deactivatePromoCode(params: {
  promoCodeId: string;
  organizationId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("promo_codes")
    .update({ active: false })
    .eq("id", params.promoCodeId)
    .eq("organization_id", params.organizationId);
  if (error) throw error;
}
