import { transitionPayment } from "./state-machine";
import crypto from "node:crypto";
import type Stripe from "stripe";

import { audit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createResaleListing,
  getResaleCheckoutListing,
} from "@/lib/resale/listing";
import {
  reserveTicket,
  releaseReservation,
  fulfillReservedTicket,
} from "@/lib/tickets/lifecycle";
import {
  checkoutPricing,
  normalizeExtras,
  normalizeQuantity,
  resolveGiftRecipientUserId,
  validateExtraGuests,
} from "@/lib/payments/checkout";
import { allocateMoney } from "@/lib/payments/pricing";
import { markPromoUsed, releasePromoUse, validateAndPricePromo } from "@/lib/promo";
import type {
  Purchase,
  ResaleListing,
  SalesChannel,
  Ticket,
  TicketCategory,
} from "@/types/db";

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
  promo_code_id: string | null;
  discount_cents: number;
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

export interface MarketplacePaymentItemRow {
  id: string;
  marketplace_payment_id: string;
  purchase_id: string;
  amount_cents: number;
  created_at: string;
}

const PAYMENT_TABLE = "marketplace_payments" as const;
const ITEM_TABLE = "marketplace_payment_items" as const;

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
    | "promo_code_id"
    | "discount_cents"
  > & {
    stripe_charge_id?: string | null;
    failure_reason?: string | null;
    promo_code_id?: string | null;
    discount_cents?: number;
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

export async function getMarketplacePaymentByPurchaseViaItems(
  purchaseId: string,
): Promise<MarketplacePaymentRow | null> {
  const sb = createServiceClient();
  const { data: item, error: itemError } = await sb
    .from(ITEM_TABLE)
    .select("marketplace_payment_id")
    .eq("purchase_id", purchaseId)
    .maybeSingle<{ marketplace_payment_id: string }>();
  if (itemError) throw itemError;
  if (!item) return null;

  const { data, error } = await sb
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("id", item.marketplace_payment_id)
    .in("status", LIVE_PAYMENT_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return (data as MarketplacePaymentRow | null) ?? null;
}

export async function listMarketplacePaymentItems(
  marketplacePaymentId: string,
): Promise<MarketplacePaymentItemRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(ITEM_TABLE)
    .select("*")
    .eq("marketplace_payment_id", marketplacePaymentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MarketplacePaymentItemRow[];
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

// A zero-amount primary checkout (free events / RSVP tickets). No Stripe
// charge and therefore no marketplace_payment row — the ticket(s) are minted
// and the purchase(s) marked paid synchronously. See ADR 0003.
export interface FreeClaimResult {
  free: true;
  purchaseIds: string[];
  amountTotalCents: 0;
  currency: "EUR";
}

export type PrimaryCheckoutResult = CheckoutResult | FreeClaimResult;

function newTransferGroup(prefix: "miso_p" | "miso_r"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function assertEur(currency: string): asserts currency is "EUR" {
  if (currency === "MAD") throw new MadCheckoutBlockedError();
  if (currency !== "EUR") {
    throw new StripeMarketplaceError(`Unsupported currency: ${currency}`, 400);
  }
}

// Scheduled release gate. Null bounds = always-open. An "early-bird" tier is a
// category whose window is currently open.
function assertSaleWindowOpen(category: TicketCategory): void {
  const now = Date.now();
  if (category.sale_starts_at && now < new Date(category.sale_starts_at).getTime()) {
    throw new StripeMarketplaceError("Sales have not started.", 400);
  }
  if (category.sale_ends_at && now > new Date(category.sale_ends_at).getTime()) {
    throw new StripeMarketplaceError("Sales have ended.", 400);
  }
}

export async function createPrimaryCheckout(input: {
  buyerUserId: string;
  categoryId: string;
  quantity?: number;
  extraGuestsCount?: number;
  giftRecipientEmail?: string | null;
  idempotencyKey?: string;
  salesChannel?: SalesChannel;
  trackingOrigin?: string | null;
  promoCode?: string | null;
}): Promise<PrimaryCheckoutResult> {
  const sb = createServiceClient();
  const quantity = normalizeQuantity(input.quantity);
  const extras = normalizeExtras(input.extraGuestsCount);
  let pendingPaymentId: string | undefined;
  // Set once markPromoUsed has consumed a use; the catch block releases it so
  // an abort before the charge is created does not leak the redemption.
  let consumedPromoCodeId: string | undefined;
  const reservedTicketIds: string[] = [];
  const purchaseIds: string[] = [];

  if (input.idempotencyKey) {
    const { data: prior } = await sb
      .from("purchases")
      .select("id")
      .eq("buyer_user_id", input.buyerUserId)
      .eq("provider_session_id", input.idempotencyKey)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (prior) {
      const existing = await getMarketplacePaymentByPurchaseViaItems(prior.id);
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
      // Free claims create no marketplace_payment (so the lookup above is null)
      // AND no marketplace_payment_items. A priced checkout that failed BEFORE
      // its charge was created (Stripe error / items insert error) also has no
      // LIVE payment, but it DID insert item rows and its purchases carry a
      // non-zero amount. Only replay the genuine free-claim path — gating on
      // "no live payment" alone would mis-report a never-charged priced
      // checkout as a completed free claim.
      if (!existing) {
        const { data: priorPurchases } = await sb
          .from("purchases")
          .select("id, amount")
          .eq("buyer_user_id", input.buyerUserId)
          .eq("provider_session_id", input.idempotencyKey)
          .returns<{ id: string; amount: number | string }[]>();
        const ids = (priorPurchases ?? []).map((p) => p.id);
        const allZeroAmount =
          ids.length > 0 &&
          (priorPurchases ?? []).every((p) => Number(p.amount) === 0);
        const { data: anyItem } = await sb
          .from(ITEM_TABLE)
          .select("id")
          .in("purchase_id", ids.length ? ids : [""])
          .limit(1)
          .maybeSingle<{ id: string }>();
        if (ids.length > 0 && allZeroAmount && !anyItem) {
          return {
            free: true,
            purchaseIds: ids,
            amountTotalCents: 0,
            currency: "EUR",
          };
        }
      }
    }
  }

  const releaseReservedTickets = async () => {
    await Promise.all(reservedTicketIds.map((id) => releaseReservation(id)));
  };

  try {
    // Resolve the gift recipient before reserving inventory so an unknown
    // recipient fails fast without reserve/release churn.
    const giftRecipientUserId = await resolveGiftRecipientUserId(
      sb,
      input.giftRecipientEmail,
    );

    const reservedTickets: Ticket[] = [];
    let category: TicketCategory | null = null;
    for (let i = 0; i < quantity; i++) {
      const reservation = await reserveTicket({
        categoryId: input.categoryId,
        buyerUserId: input.buyerUserId,
      });
      category = reservation.category;
      reservedTickets.push(reservation.ticket);
      reservedTicketIds.push(reservation.ticket.id);
    }
    if (!category || reservedTickets.length === 0) {
      throw new Error("Ticket could not be reserved.");
    }

    assertSaleWindowOpen(category);
    validateExtraGuests(category, extras);
    const pricing = checkoutPricing(category, extras);
    const perTicketCents = toCents(pricing.amount);
    const grossTotalCents = perTicketCents * quantity;

    const { data: event } = await sb
      .from("events")
      .select("*")
      .eq("id", reservedTickets[0].event_id)
      .single<EventRowWithOrganizer>();
    if (!event) throw new StripeMarketplaceError("Event not found.", 404);

    const salesChannel = input.salesChannel ?? "marketplace";
    const trackingOrigin = input.trackingOrigin ?? null;

    // Zero-amount checkout (free / RSVP tickets — a price-0 general category;
    // a club table priced 0 still charges its online advance, so it lands on
    // the paid path below via grossTotalCents). No Stripe charge, no
    // transfers, no marketplace_payment (ADR 0003): reserve, record the
    // purchase, mint, mark paid. The outer catch releases tickets + fails
    // pending purchases on any error (minted/paid rows are left intact).
    if (grossTotalCents <= 0) {
      for (const ticket of reservedTickets) {
        const { data: purchase, error: purchaseError } = await sb
          .from("purchases")
          .insert({
            buyer_user_id: input.buyerUserId,
            event_id: event.id,
            ticket_id: ticket.id,
            amount: pricing.amount,
            currency: category.currency,
            status: "pending",
            provider_session_id: input.idempotencyKey ?? null,
            gift_recipient_user_id: giftRecipientUserId,
            extra_guests_count: extras,
            online_advance_amount: pricing.onlineAdvanceAmount,
            min_spending_total: pricing.minSpendingTotal,
            sales_channel: salesChannel,
            tracking_origin: trackingOrigin,
          })
          .select("*")
          .single<Purchase>();
        if (purchaseError || !purchase) {
          throw purchaseError ?? new Error("Purchase could not be created.");
        }
        purchaseIds.push(purchase.id);
      }
      const nowIso = new Date().toISOString();
      for (let i = 0; i < reservedTickets.length; i++) {
        await fulfillReservedTicket({
          ticketId: reservedTickets[i].id,
          buyerUserId: input.buyerUserId,
          purchaseId: purchaseIds[i],
        });
        await sb
          .from("purchases")
          .update({ status: "paid", paid_at: nowIso })
          .eq("id", purchaseIds[i])
          .neq("status", "refunded");
      }
      await audit({
        actorUserId: input.buyerUserId,
        action: "marketplace.primary.free_claim",
        entityType: "purchase",
        entityId: purchaseIds[0],
        metadata: {
          purchase_ids: purchaseIds,
          ticket_ids: reservedTicketIds,
          quantity,
        },
      });
      return {
        free: true,
        purchaseIds,
        amountTotalCents: 0,
        currency: "EUR",
      };
    }

    assertEur(category.currency);
    const organizerUserId = event.organizer_user_id;
    if (!organizerUserId) {
      throw new StripeMarketplaceError("Event has no organizer assigned.", 409);
    }
    const seller = await assertPayoutReady(organizerUserId, "organizer");

    for (const ticket of reservedTickets) {
      const { data: purchase, error: purchaseError } = await sb
        .from("purchases")
        .insert({
          buyer_user_id: input.buyerUserId,
          event_id: event.id,
          ticket_id: ticket.id,
          amount: pricing.amount,
          currency: category.currency,
          status: "pending",
          provider_session_id: input.idempotencyKey ?? null,
          gift_recipient_user_id: giftRecipientUserId,
          extra_guests_count: extras,
          online_advance_amount: pricing.onlineAdvanceAmount,
          min_spending_total: pricing.minSpendingTotal,
          sales_channel: salesChannel,
          tracking_origin: trackingOrigin,
        })
        .select("*")
        .single<Purchase>();
      if (purchaseError || !purchase) {
        throw purchaseError ?? new Error("Purchase could not be created.");
      }
      purchaseIds.push(purchase.id);
    }

    const env = stripeEnv();

    // The organizer absorbs the promo discount: validate + price server-side,
    // then feed the DISCOUNTED gross through computePrimaryBreakdown so the
    // buyer charge, marketplace fee, and primary-seller transfer all recompute
    // consistently. Promo never applies to the free-claim path (handled above).
    let promoCodeId: string | null = null;
    let discountCents = 0;
    if (input.promoCode) {
      const promo = await validateAndPricePromo({
        code: input.promoCode,
        organizationId: event.organization_id,
        grossCents: grossTotalCents,
      });
      promoCodeId = promo.promoCodeId;
      discountCents = promo.discountCents;
    }
    const effectiveGrossCents = grossTotalCents - discountCents;

    const breakdown = computePrimaryBreakdown({
      grossCents: effectiveGrossCents,
      marketplaceFeeBps: env.MISO_MARKETPLACE_FEE_BPS,
    });
    const transferGroup = newTransferGroup("miso_p");

    // Consume the use atomically before charging. If the conditional increment
    // reports the code exhausted (a concurrent checkout claimed the last use),
    // abort with a 409 — the outer catch releases reserved tickets.
    if (promoCodeId) {
      const consumed = await markPromoUsed(promoCodeId);
      if (!consumed) {
        throw new StripeMarketplaceError(
          "Promo code has reached its usage limit.",
          409,
        );
      }
      consumedPromoCodeId = promoCodeId;
    }

    const payment = await insertMarketplacePayment({
      kind: "primary",
      buyer_user_id: input.buyerUserId,
      primary_seller_user_id: organizerUserId,
      organizer_user_id: organizerUserId,
      purchase_id: null,
      resale_listing_id: null,
      amount_total_cents: breakdown.amountTotalCents,
      currency: "EUR",
      marketplace_fee_bps: breakdown.marketplaceFeeBps,
      marketplace_fee_cents: breakdown.marketplaceFeeCents,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: breakdown.primarySellerCents,
      promo_code_id: promoCodeId,
      discount_cents: discountCents,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      stripe_transfer_group: transferGroup,
      status: "requires_payment",
    });
    pendingPaymentId = payment.id;

    // Allocate the DISCOUNTED total across items so the per-purchase shares sum
    // to the actual buyer charge (breakdown.amountTotalCents).
    const itemCents = allocateMoney(fromCents(effectiveGrossCents), quantity).map(
      toCents,
    );
    const { error: itemsError } = await sb.from(ITEM_TABLE).insert(
      purchaseIds.map((purchaseId, index) => ({
        marketplace_payment_id: payment.id,
        purchase_id: purchaseId,
        amount_cents: itemCents[index] ?? 0,
      })),
    );
    if (itemsError) throw itemsError;

    const intent = await createPaymentIntent({
      amountCents: breakdown.amountTotalCents,
      transferGroup,
      idempotencyKey: input.idempotencyKey
        ? `pi_primary_${input.idempotencyKey}`
        : undefined,
      metadata: {
        marketplace_payment_id: payment.id,
        kind: "primary",
        quantity: String(quantity),
        organizer_user_id: organizerUserId,
        organizer_stripe_account: seller.stripe_account_id,
      },
    });

    await transitionPayment(payment.id, {
      type: "CHECKOUT_CREATED",
      intentId: intent.id,
    });

    // purchase_id is null on multi-item payments, so the state machine
    // cannot mirror the intent onto the per-ticket purchases — do it here.
    await sb
      .from("purchases")
      .update({ provider_payment_id: intent.id, payment_provider: "stripe" })
      .in("id", purchaseIds);

    await audit({
      actorUserId: input.buyerUserId,
      action: "marketplace.primary.checkout_created",
      entityType: "marketplace_payment",
      entityId: payment.id,
      metadata: {
        purchase_ids: purchaseIds,
        ticket_ids: reservedTicketIds,
        quantity,
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
    if (pendingPaymentId) {
      await transitionPayment(pendingPaymentId, {
        type: "CHECKOUT_ABORTED",
        reason: error instanceof Error ? error.message : "checkout aborted",
      });
    }
    // purchase_id is null on the payment, so releaseInventory in the state
    // machine is a no-op; release the N reserved tickets + fail their
    // pending purchases here regardless of how far the checkout progressed.
    if (purchaseIds.length) {
      await sb
        .from("purchases")
        .update({ status: "failed" })
        .in("id", purchaseIds)
        .eq("status", "pending");
    }
    // A use was consumed but the charge was never created — return it to the
    // pool so an abort (Stripe error, items insert error) does not leak a
    // redemption and prematurely exhaust a capped code.
    if (consumedPromoCodeId) {
      await releasePromoUse(consumedPromoCodeId);
    }
    await releaseReservedTickets();
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

export const MIN_GROSS_CENTS = 1;
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
