import { transitionPayment } from "./state-machine";
import crypto from "node:crypto";
import type Stripe from "stripe";

import { audit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createResaleListing,
  getResaleCheckoutListing,
} from "@/lib/resale/listing";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import type { Purchase, ResaleListing } from "@/types/db";

import { stripeClient, stripeEnv } from "./client";
import type { EventRowWithOrganizer } from "./types";
import { MadCheckoutBlockedError, StripeMarketplaceError } from "./errors";
import { assertPayoutReady } from "./seller-accounts";

export type MarketplacePaymentKind = "primary" | "resale";

export type MarketplacePaymentStatus =
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "fulfillment_pending"
  | "transfers_pending"
  | "paid"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "repair_needed";

export interface MarketplacePaymentRow {
  id: string;
  kind: MarketplacePaymentKind;
  buyer_user_id: string;
  primary_seller_user_id: string;
  organizer_user_id: string | null;
  purchase_id: string | null;
  resale_listing_id: string | null;
  amount_total_cents: number;
  currency: "EUR";
  marketplace_fee_bps: number;
  marketplace_fee_cents: number;
  organizer_royalty_bps: number;
  organizer_royalty_cents: number;
  primary_seller_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_group: string | null;
  status: MarketplacePaymentStatus;
  failure_reason: string | null;
  succeeded_at: string | null;
  fulfilled_at: string | null;
  transferred_at: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  last_webhook_at: string | null;
  created_at: string;
  updated_at: string;
}

const PAYMENT_TABLE = "marketplace_payments" as const;

export async function insertMarketplacePayment(
  row: Omit<
    MarketplacePaymentRow,
    | "id"
    | "created_at"
    | "updated_at"
    | "succeeded_at"
    | "fulfilled_at"
    | "transferred_at"
    | "refunded_at"
    | "disputed_at"
    | "last_webhook_at"
    | "failure_reason"
    | "stripe_charge_id"
  > & {
    stripe_charge_id?: string | null;
    failure_reason?: string | null;
  },
): Promise<MarketplacePaymentRow> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(PAYMENT_TABLE)
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketplacePaymentRow;
}

export async function getMarketplacePaymentByIntent(
  paymentIntentId: string,
): Promise<MarketplacePaymentRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return (data as MarketplacePaymentRow | null) ?? null;
}

const LIVE_PAYMENT_STATUSES: MarketplacePaymentStatus[] = [
  "requires_payment",
  "processing",
  "succeeded",
  "fulfillment_pending",
  "transfers_pending",
  "paid",
  "repair_needed",
  "refund_pending",
  "disputed",
];

export async function getMarketplacePaymentByPurchase(
  purchaseId: string,
): Promise<MarketplacePaymentRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("purchase_id", purchaseId)
    .in("status", LIVE_PAYMENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MarketplacePaymentRow | null) ?? null;
}

export async function getMarketplacePaymentByListing(
  listingId: string,
): Promise<MarketplacePaymentRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("resale_listing_id", listingId)
    .in("status", LIVE_PAYMENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MarketplacePaymentRow | null) ?? null;
}

export interface CheckoutResult {
  marketplacePaymentId: string;
  paymentIntentId: string;
  clientSecret: string;
  amountTotalCents: number;
  currency: "EUR";
}

function newTransferGroup(prefix: "miso_p" | "miso_r"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function assertEur(currency: string): asserts currency is "EUR" {
  if (currency === "MAD") throw new MadCheckoutBlockedError();
  if (currency !== "EUR") {
    throw new StripeMarketplaceError(`Unsupported currency: ${currency}`, 400);
  }
}

export async function createPrimaryCheckout(input: {
  buyerUserId: string;
  categoryId: string;
  idempotencyKey?: string;
}): Promise<CheckoutResult> {
  const sb = createServiceClient();
  let pendingPaymentId: string | undefined;

  if (input.idempotencyKey) {
    const { data: prior } = await sb
      .from("purchases")
      .select("id")
      .eq("buyer_user_id", input.buyerUserId)
      .eq("provider_session_id", input.idempotencyKey)
      .maybeSingle<{ id: string }>();
    if (prior) {
      const existing = await getMarketplacePaymentByPurchase(prior.id);
      if (existing && existing.stripe_payment_intent_id) {
        const reused = await stripeClient().paymentIntents.retrieve(
          existing.stripe_payment_intent_id,
        );
        return {
          marketplacePaymentId: existing.id,
          paymentIntentId: reused.id,
          clientSecret: reused.client_secret!,
          amountTotalCents: existing.amount_total_cents,
          currency: "EUR",
        };
      }
    }
  }

  const { ticket, category } = await reserveTicket({
    categoryId: input.categoryId,
    buyerUserId: input.buyerUserId,
  });

  try {
    assertEur(category.currency);
    if (Number(category.price) <= 0) {
      throw new StripeMarketplaceError(
        "Free storefront checkout is unavailable.",
        400,
      );
    }

    const { data: event } = await sb
      .from("events")
      .select("*")
      .eq("id", ticket.event_id)
      .single<EventRowWithOrganizer>();
    if (!event) throw new StripeMarketplaceError("Event not found.", 404);

    const organizerUserId = event.organizer_user_id;
    if (!organizerUserId) {
      throw new StripeMarketplaceError("Event has no organizer assigned.", 409);
    }
    const seller = await assertPayoutReady(organizerUserId, "organizer");

    const { data: purchase, error: purchaseError } = await sb
      .from("purchases")
      .insert({
        buyer_user_id: input.buyerUserId,
        event_id: event.id,
        ticket_id: ticket.id,
        amount: category.price,
        currency: category.currency,
        status: "pending",
        provider_session_id: input.idempotencyKey ?? null,
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) {
      throw purchaseError ?? new Error("Purchase could not be created.");
    }

    const env = stripeEnv();
    const breakdown = computePrimaryBreakdown({
      grossCents: toCents(category.price),
      marketplaceFeeBps: env.MISO_MARKETPLACE_FEE_BPS,
    });
    const transferGroup = newTransferGroup("miso_p");

    const payment = await insertMarketplacePayment({
      kind: "primary",
      buyer_user_id: input.buyerUserId,
      primary_seller_user_id: organizerUserId,
      organizer_user_id: organizerUserId,
      purchase_id: purchase.id,
      resale_listing_id: null,
      amount_total_cents: breakdown.amountTotalCents,
      currency: "EUR",
      marketplace_fee_bps: breakdown.marketplaceFeeBps,
      marketplace_fee_cents: breakdown.marketplaceFeeCents,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: breakdown.primarySellerCents,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      stripe_transfer_group: transferGroup,
      status: "requires_payment",
    });
    pendingPaymentId = payment.id;

    const intent = await createPaymentIntent({
      amountCents: breakdown.amountTotalCents,
      transferGroup,
      idempotencyKey: input.idempotencyKey
        ? `pi_primary_${input.idempotencyKey}`
        : undefined,
      metadata: {
        marketplace_payment_id: payment.id,
        kind: "primary",
        purchase_id: purchase.id,
        ticket_id: ticket.id,
        organizer_user_id: organizerUserId,
        organizer_stripe_account: seller.stripe_account_id,
      },
    });

    await transitionPayment(payment.id, {
      type: "CHECKOUT_CREATED",
      intentId: intent.id,
    });

    await audit({
      actorUserId: input.buyerUserId,
      action: "marketplace.primary.checkout_created",
      entityType: "marketplace_payment",
      entityId: payment.id,
      metadata: {
        purchase_id: purchase.id,
        ticket_id: ticket.id,
        amount_total_cents: breakdown.amountTotalCents,
        transfer_group: transferGroup,
      },
    });

    return {
      marketplacePaymentId: payment.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret!,
      amountTotalCents: breakdown.amountTotalCents,
      currency: "EUR",
    };
  } catch (error) {
    let canReleaseInventory = true;
    if (pendingPaymentId) {
      await transitionPayment(pendingPaymentId, {
        type: "CHECKOUT_ABORTED",
        reason: error instanceof Error ? error.message : "checkout aborted",
      });
      canReleaseInventory = false; // State machine handles release
    }
    if (canReleaseInventory) {
      await sb
        .from("purchases")
        .update({ status: "failed" })
        .eq("buyer_user_id", input.buyerUserId)
        .eq("ticket_id", ticket.id)
        .eq("status", "pending");
      await sb
        .from("tickets")
        .update({
          status: "available",
          reserved_until: null,
          owner_user_id: null,
        })
        .eq("id", ticket.id)
        .eq("status", "reserved")
        .eq("owner_user_id", input.buyerUserId);
    }
    throw error;
  }
}

export async function createResaleCheckout(input: {
  buyerUserId: string;
  listingId: string;
  idempotencyKey?: string;
}): Promise<CheckoutResult> {
  const sb = createServiceClient();

  const existing = await getMarketplacePaymentByListing(input.listingId);
  if (
    existing &&
    existing.buyer_user_id === input.buyerUserId &&
    (existing.status === "requires_payment" ||
      existing.status === "processing") &&
    existing.stripe_payment_intent_id
  ) {
    const reused = await stripeClient().paymentIntents.retrieve(
      existing.stripe_payment_intent_id,
    );
    return {
      marketplacePaymentId: existing.id,
      paymentIntentId: reused.id,
      clientSecret: reused.client_secret!,
      amountTotalCents: existing.amount_total_cents,
      currency: "EUR",
    };
  }

  const listing = await getResaleCheckoutListing({
    listingId: input.listingId,
    buyerUserId: input.buyerUserId,
  });
  assertEur(listing.currency);

  const { data: ticket } = await sb
    .from("tickets")
    .select("event_id")
    .eq("id", listing.ticket_id)
    .single<{ event_id: string }>();
  if (!ticket) throw new StripeMarketplaceError("Ticket missing.", 404);
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRowWithOrganizer>();
  if (!event) throw new StripeMarketplaceError("Event not found.", 404);

  const env = stripeEnv();
  const royaltyBps = Math.max(0, event.organizer_resale_royalty_bps ?? 0);
  if (royaltyBps > 0 && !event.organizer_user_id) {
    throw new StripeMarketplaceError(
      "Organizer royalty configured but event has no organizer assigned.",
      409,
    );
  }

  const sellerSeller = await assertPayoutReady(
    listing.seller_user_id,
    "resale_seller",
  );
  const organizerSeller =
    royaltyBps > 0 && event.organizer_user_id
      ? await assertPayoutReady(event.organizer_user_id, "organizer")
      : null;

  const { data: claimed } = await sb
    .from("resale_listings")
    .update({
      status: "transferring",
      buyer_user_id: input.buyerUserId,
    })
    .eq("id", listing.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    throw new StripeMarketplaceError("Listing is no longer active.", 409);
  }

  let pendingPaymentId: string | undefined;
  try {
    const breakdown = computeResaleBreakdown({
      grossCents: toCents(listing.price),
      marketplaceFeeBps: env.MISO_MARKETPLACE_FEE_BPS,
      organizerRoyaltyBps: royaltyBps,
    });
    const transferGroup = newTransferGroup("miso_r");

    const payment = await insertMarketplacePayment({
      kind: "resale",
      buyer_user_id: input.buyerUserId,
      primary_seller_user_id: listing.seller_user_id,
      organizer_user_id: event.organizer_user_id ?? null,
      purchase_id: null,
      resale_listing_id: listing.id,
      amount_total_cents: breakdown.amountTotalCents,
      currency: "EUR",
      marketplace_fee_bps: breakdown.marketplaceFeeBps,
      marketplace_fee_cents: breakdown.marketplaceFeeCents,
      organizer_royalty_bps: breakdown.organizerRoyaltyBps,
      organizer_royalty_cents: breakdown.organizerRoyaltyCents,
      primary_seller_cents: breakdown.primarySellerCents,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      stripe_transfer_group: transferGroup,
      status: "requires_payment",
    });
    pendingPaymentId = payment.id;

    const intent = await createPaymentIntent({
      amountCents: breakdown.amountTotalCents,
      transferGroup,
      idempotencyKey: input.idempotencyKey
        ? `pi_resale_${input.idempotencyKey}`
        : undefined,
      metadata: {
        marketplace_payment_id: payment.id,
        kind: "resale",
        listing_id: listing.id,
        ticket_id: listing.ticket_id,
        resale_seller_user_id: listing.seller_user_id,
        resale_seller_stripe_account: sellerSeller.stripe_account_id,
        ...(organizerSeller
          ? {
              organizer_user_id: event.organizer_user_id!,
              organizer_stripe_account: organizerSeller.stripe_account_id,
            }
          : {}),
      },
    });

    await transitionPayment(payment.id, {
      type: "CHECKOUT_CREATED",
      intentId: intent.id,
    });

    await audit({
      actorUserId: input.buyerUserId,
      action: "marketplace.resale.checkout_created",
      entityType: "marketplace_payment",
      entityId: payment.id,
      metadata: {
        listing_id: listing.id,
        ticket_id: listing.ticket_id,
        amount_total_cents: breakdown.amountTotalCents,
        organizer_royalty_bps: breakdown.organizerRoyaltyBps,
        transfer_group: transferGroup,
      },
    });

    return {
      marketplacePaymentId: payment.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret!,
      amountTotalCents: breakdown.amountTotalCents,
      currency: "EUR",
    };
  } catch (err) {
    let canReleaseInventory = true;
    if (pendingPaymentId) {
      await transitionPayment(pendingPaymentId, {
        type: "CHECKOUT_ABORTED",
        reason: err instanceof Error ? err.message : "checkout aborted",
      });
      canReleaseInventory = false;
    }
    if (canReleaseInventory) {
      await sb
        .from("resale_listings")
        .update({ status: "active", buyer_user_id: null })
        .eq("id", listing.id)
        .eq("status", "transferring")
        .eq("buyer_user_id", input.buyerUserId);
    }
    throw err;
  }
}

async function createPaymentIntent(params: {
  amountCents: number;
  transferGroup: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
}): Promise<Stripe.PaymentIntent> {
  const stripe = stripeClient();
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: "eur",
      transfer_group: params.transferGroup,
      metadata: params.metadata,
    },
    params.idempotencyKey
      ? { idempotencyKey: params.idempotencyKey }
      : undefined,
  );
}

export { createResaleListing, getResaleCheckoutListing };
export type { ResaleListing };

export type SupportedCurrency = "EUR";

export interface PrimaryFeeBreakdown {
  amountTotalCents: number;
  marketplaceFeeBps: number;
  marketplaceFeeCents: number;
  primarySellerCents: number;
  organizerRoyaltyBps: 0;
  organizerRoyaltyCents: 0;
}

export interface ResaleFeeBreakdown {
  amountTotalCents: number;
  marketplaceFeeBps: number;
  marketplaceFeeCents: number;
  organizerRoyaltyBps: number;
  organizerRoyaltyCents: number;
  primarySellerCents: number;
}

export interface FeeInputs {
  grossCents: number;
  marketplaceFeeBps: number;
}

const MIN_GROSS_CENTS = 1;
const BPS_DENOMINATOR = 10_000;

function assertNonNegativeInt(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative integer cents value`);
  }
}

function assertBps(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0 || n > BPS_DENOMINATOR) {
    throw new RangeError(`${label} must be an integer between 0 and 10000`);
  }
}

function bpsOf(amountCents: number, bps: number): number {
  return Math.floor((amountCents * bps) / BPS_DENOMINATOR);
}

export function computePrimaryBreakdown(input: FeeInputs): PrimaryFeeBreakdown {
  assertNonNegativeInt(input.grossCents, "grossCents");
  assertBps(input.marketplaceFeeBps, "marketplaceFeeBps");
  if (input.grossCents < MIN_GROSS_CENTS) {
    throw new RangeError("grossCents must be > 0 for marketplace settlement");
  }
  const marketplaceFeeCents = bpsOf(input.grossCents, input.marketplaceFeeBps);
  const primarySellerCents = input.grossCents - marketplaceFeeCents;
  return {
    amountTotalCents: input.grossCents,
    marketplaceFeeBps: input.marketplaceFeeBps,
    marketplaceFeeCents,
    primarySellerCents,
    organizerRoyaltyBps: 0,
    organizerRoyaltyCents: 0,
  };
}

export function computeResaleBreakdown(
  input: FeeInputs & { organizerRoyaltyBps: number },
): ResaleFeeBreakdown {
  assertNonNegativeInt(input.grossCents, "grossCents");
  assertBps(input.marketplaceFeeBps, "marketplaceFeeBps");
  assertBps(input.organizerRoyaltyBps, "organizerRoyaltyBps");
  if (input.grossCents < MIN_GROSS_CENTS) {
    throw new RangeError("grossCents must be > 0 for marketplace settlement");
  }
  if (input.marketplaceFeeBps + input.organizerRoyaltyBps > BPS_DENOMINATOR) {
    throw new RangeError(
      "marketplaceFeeBps + organizerRoyaltyBps cannot exceed 10000",
    );
  }
  const marketplaceFeeCents = bpsOf(input.grossCents, input.marketplaceFeeBps);
  const organizerRoyaltyCents = bpsOf(
    input.grossCents,
    input.organizerRoyaltyBps,
  );
  const primarySellerCents =
    input.grossCents - marketplaceFeeCents - organizerRoyaltyCents;
  if (primarySellerCents < 0) {
    throw new RangeError("Computed seller net is negative");
  }
  return {
    amountTotalCents: input.grossCents,
    marketplaceFeeBps: input.marketplaceFeeBps,
    marketplaceFeeCents,
    organizerRoyaltyBps: input.organizerRoyaltyBps,
    organizerRoyaltyCents,
    primarySellerCents,
  };
}

export function toCents(priceMajorUnits: number | string): number {
  const num =
    typeof priceMajorUnits === "string"
      ? Number(priceMajorUnits)
      : priceMajorUnits;
  if (!Number.isFinite(num) || num < 0) {
    throw new RangeError("price must be a finite non-negative number");
  }
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError("cents must be a non-negative integer");
  }
  return Math.round(cents) / 100;
}
