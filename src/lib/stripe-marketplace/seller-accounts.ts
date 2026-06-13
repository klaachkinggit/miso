import type Stripe from "stripe";
import { setTimeout as sleep } from "node:timers/promises";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshOrganizerLiveStatus } from "@/lib/organizers/profile";
import { stripeClient } from "./client";
import { SellerNotPayoutReadyError, SellerRiskBlockedError } from "./errors";

export type SellerRiskStatus =
  | "clear"
  | "restricted"
  | "owes_recovery"
  | "blocked";

export interface StripeSellerAccountRow {
  id: string;
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  requirements_json: unknown;
  seller_risk_status: SellerRiskStatus;
  last_webhook_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELLER_TABLE = "stripe_seller_accounts" as const;

export async function getSellerAccountByUserId(
  userId: string,
): Promise<StripeSellerAccountRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(SELLER_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as StripeSellerAccountRow | null) ?? null;
}

export async function getSellerAccountByStripeId(
  stripeAccountId: string,
): Promise<StripeSellerAccountRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(SELLER_TABLE)
    .select("*")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as StripeSellerAccountRow | null) ?? null;
}

export async function upsertSellerAccount(input: {
  user_id: string;
  stripe_account_id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  disabled_reason?: string | null;
  requirements_json?: unknown;
  seller_risk_status?: SellerRiskStatus;
}): Promise<StripeSellerAccountRow> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(SELLER_TABLE)
    .upsert(
      {
        ...input,
        last_webhook_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as StripeSellerAccountRow;
}

export interface OnboardingLinkResult {
  url: string;
  stripeAccountId: string;
  expiresAt: number;
}

const PENDING_STRIPE_ACCOUNT_PREFIX = "pending_";

export async function ensureSellerAccount(input: {
  userId: string;
  email: string;
}): Promise<StripeSellerAccountRow> {
  const existing = await getSellerAccountByUserId(input.userId);
  if (
    existing &&
    !existing.stripe_account_id.startsWith(PENDING_STRIPE_ACCOUNT_PREFIX)
  ) {
    return existing;
  }
  if (existing?.stripe_account_id.startsWith(PENDING_STRIPE_ACCOUNT_PREFIX)) {
    const resolved = await waitForPendingSellerAccount(input.userId);
    if (resolved) return resolved;
    throw new Error(
      "Seller onboarding is already being prepared. Retry shortly.",
    );
  }

  const sb = createServiceClient();
  const placeholderAccountId = `${PENDING_STRIPE_ACCOUNT_PREFIX}${input.userId}`;
  const { error: insertErr } = await sb.from("stripe_seller_accounts").insert({
    user_id: input.userId,
    stripe_account_id: placeholderAccountId,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    seller_risk_status: "restricted",
  });
  if (insertErr && (insertErr as { code?: string }).code !== "23505") {
    throw insertErr;
  }
  if (insertErr) {
    const resolved = await waitForPendingSellerAccount(input.userId);
    if (resolved) return resolved;
    throw new Error(
      "Seller onboarding is already being prepared. Retry shortly.",
    );
  }

  const claimed = await getSellerAccountByUserId(input.userId);
  if (!claimed) throw new Error("Seller pre-claim disappeared");
  if (!claimed.stripe_account_id.startsWith(PENDING_STRIPE_ACCOUNT_PREFIX)) {
    return claimed;
  }

  const stripe = stripeClient();
  const account = await stripe.accounts.create({
    type: "express",
    email: input.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { miso_user_id: input.userId },
  });

  const seller = await upsertSellerAccount({
    user_id: input.userId,
    stripe_account_id: account.id,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    disabled_reason: account.requirements?.disabled_reason ?? null,
    requirements_json: account.requirements ?? null,
  });
  await refreshOrganizerLiveStatus(input.userId);
  return seller;
}

async function waitForPendingSellerAccount(
  userId: string,
): Promise<StripeSellerAccountRow | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(150 + attempt * 100);
    const row = await getSellerAccountByUserId(userId);
    if (
      row &&
      !row.stripe_account_id.startsWith(PENDING_STRIPE_ACCOUNT_PREFIX)
    ) {
      return row;
    }
  }
  return null;
}

export async function createOnboardingLink(input: {
  userId: string;
  email: string;
  appUrl: string;
  returnPath?: string;
}): Promise<OnboardingLinkResult> {
  const seller = await ensureSellerAccount({
    userId: input.userId,
    email: input.email,
  });
  const stripe = stripeClient();
  const returnPath = input.returnPath ?? "/smartboard?tab=banking";
  const returnUrl = `${input.appUrl}${returnPath}`;
  const refreshUrl = `${input.appUrl}/api/stripe-marketplace/onboarding/refresh?return_path=${encodeURIComponent(returnPath)}`;
  const link = await stripe.accountLinks.create({
    account: seller.stripe_account_id,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return {
    url: link.url,
    stripeAccountId: seller.stripe_account_id,
    expiresAt: link.expires_at,
  };
}

export async function syncSellerAccountFromStripe(
  stripeAccountId: string,
): Promise<StripeSellerAccountRow> {
  const stripe = stripeClient();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const existing = await getSellerAccountByStripeId(stripeAccountId);
  if (!existing) {
    throw new Error(
      `Received account.updated for unknown Stripe account ${stripeAccountId}`,
    );
  }
  return applyAccountSnapshot(existing.user_id, account);
}

export async function applyAccountSnapshot(
  userId: string,
  account: Stripe.Account,
): Promise<StripeSellerAccountRow> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("apply_stripe_account_snapshot", {
    p_user_id: userId,
    p_stripe_account_id: account.id,
    p_charges_enabled: account.charges_enabled,
    p_payouts_enabled: account.payouts_enabled,
    p_details_submitted: account.details_submitted,
    p_disabled_reason: account.requirements?.disabled_reason ?? null,
    p_requirements_json: (account.requirements ?? null) as never,
  });
  if (error) throw error;
  if (!data) throw new Error("apply_stripe_account_snapshot returned no row");
  const seller = data as unknown as StripeSellerAccountRow;
  await refreshOrganizerLiveStatus(userId);
  return seller;
}

export interface PayoutReadinessCheck {
  ready: boolean;
  reason?:
    | "no_account"
    | "charges_disabled"
    | "payouts_disabled"
    | "risk_blocked";
  seller?: StripeSellerAccountRow;
}

export async function checkPayoutReadiness(
  userId: string,
): Promise<PayoutReadinessCheck> {
  const seller = await getSellerAccountByUserId(userId);
  if (!seller) return { ready: false, reason: "no_account" };
  if (!seller.charges_enabled)
    return { ready: false, reason: "charges_disabled", seller };
  if (!seller.payouts_enabled)
    return { ready: false, reason: "payouts_disabled", seller };
  if (seller.seller_risk_status !== "clear") {
    return { ready: false, reason: "risk_blocked", seller };
  }
  return { ready: true, seller };
}

export async function assertPayoutReady(
  userId: string,
  who: "organizer" | "resale_seller",
): Promise<StripeSellerAccountRow> {
  const check = await checkPayoutReadiness(userId);
  if (check.ready && check.seller) return check.seller;
  if (check.reason === "risk_blocked") throw new SellerRiskBlockedError();
  throw new SellerNotPayoutReadyError(
    `${who === "organizer" ? "Organizer" : "Resale seller"} is not payout-ready.`,
  );
}
