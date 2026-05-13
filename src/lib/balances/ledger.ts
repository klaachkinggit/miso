import { createServiceClient } from "@/lib/supabase/service";
import type {
  BalanceLedgerEntry,
  BalanceMovementType,
  Currency,
} from "@/types/db";

type ReferenceType =
  | "seed"
  | "admin_topup"
  | "purchase"
  | "resale_listing"
  | "ticket_refund";

export class InsufficientBalanceError extends Error {
  constructor(message = "Insufficient Account Balance.") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

function normalizeAmount(amount: number | string): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Amount must be positive.");
  }
  return numeric.toFixed(2);
}

function normalizeRpcError(error: unknown): Error {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : "Balance movement failed.";
  if (message.toLowerCase().includes("insufficient account balance")) {
    return new InsufficientBalanceError();
  }
  return new Error(message);
}

async function recordCredit(params: {
  profileId: string;
  currency: Currency;
  movementType: Extract<
    BalanceMovementType,
    | "seed_credit"
    | "admin_topup_credit"
    | "resale_seller_credit"
    | "refund_credit"
    | "compensation_credit"
  >;
  amount: number | string;
  referenceType: ReferenceType;
  referenceId: string;
}): Promise<BalanceLedgerEntry> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .rpc("account_balance_credit", {
      p_profile_id: params.profileId,
      p_currency: params.currency,
      p_movement_type: params.movementType,
      p_amount: normalizeAmount(params.amount),
      p_reference_type: params.referenceType,
      p_reference_id: params.referenceId,
    })
    .single<BalanceLedgerEntry>();
  if (error || !data) throw normalizeRpcError(error);
  return data;
}

async function recordDebit(params: {
  profileId: string;
  currency: Currency;
  movementType: Extract<BalanceMovementType, "purchase_debit" | "resale_buyer_debit">;
  amount: number | string;
  referenceType: ReferenceType;
  referenceId: string;
}): Promise<BalanceLedgerEntry> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .rpc("account_balance_debit", {
      p_profile_id: params.profileId,
      p_currency: params.currency,
      p_movement_type: params.movementType,
      p_amount: normalizeAmount(params.amount),
      p_reference_type: params.referenceType,
      p_reference_id: params.referenceId,
    })
    .single<BalanceLedgerEntry>();
  if (error || !data) throw normalizeRpcError(error);
  return data;
}

export function creditSeedBalance(params: {
  profileId: string;
  currency: Currency;
  amount: number | string;
  referenceId: string;
}) {
  return recordCredit({
    profileId: params.profileId,
    currency: params.currency,
    amount: params.amount,
    movementType: "seed_credit",
    referenceType: "seed",
    referenceId: params.referenceId,
  });
}

export function creditAdminTopup(params: {
  profileId: string;
  currency: Currency;
  amount: number | string;
  referenceId: string;
}) {
  return recordCredit({
    profileId: params.profileId,
    currency: params.currency,
    amount: params.amount,
    movementType: "admin_topup_credit",
    referenceType: "admin_topup",
    referenceId: params.referenceId,
  });
}

export function debitPurchaseBalance(params: {
  purchaseId: string;
  buyerUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordDebit({
    profileId: params.buyerUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "purchase_debit",
    referenceType: "purchase",
    referenceId: params.purchaseId,
  });
}

export function compensatePurchaseDebit(params: {
  purchaseId: string;
  buyerUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordCredit({
    profileId: params.buyerUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "compensation_credit",
    referenceType: "purchase",
    referenceId: params.purchaseId,
  });
}

export function debitResaleBuyerBalance(params: {
  listingId: string;
  buyerUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordDebit({
    profileId: params.buyerUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "resale_buyer_debit",
    referenceType: "resale_listing",
    referenceId: params.listingId,
  });
}

export function creditResaleSellerBalance(params: {
  listingId: string;
  sellerUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordCredit({
    profileId: params.sellerUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "resale_seller_credit",
    referenceType: "resale_listing",
    referenceId: params.listingId,
  });
}

export function compensateResaleBuyerDebit(params: {
  listingId: string;
  buyerUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordCredit({
    profileId: params.buyerUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "compensation_credit",
    referenceType: "resale_listing",
    referenceId: params.listingId,
  });
}

export function creditRefundBalance(params: {
  ticketId: string;
  holderUserId: string;
  amount: number | string;
  currency: Currency;
}) {
  return recordCredit({
    profileId: params.holderUserId,
    currency: params.currency,
    amount: params.amount,
    movementType: "refund_credit",
    referenceType: "ticket_refund",
    referenceId: params.ticketId,
  });
}
