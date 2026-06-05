import { computeClubTablePricing } from "@/lib/payments/pricing";
import { settleFailedPurchase } from "@/lib/payments/settlement";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
} from "@/lib/payments/stripe";
import { DomainError } from "@/lib/api/errors";
import { assertOrganizationCanAcceptPaidSales } from "@/lib/organizations/payments";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import type { EventRow, Purchase, SalesChannel, Ticket, TicketCategory } from "@/types/db";

export interface PurchaseCheckoutResult {
  purchaseId: string;
  checkoutUrl: string;
  idempotentReplay: boolean;
}

export class GiftRecipientNotFoundError extends DomainError {
  constructor(email: string) {
    super(`No MISO account is registered for ${email}.`);
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

interface CheckoutPricing {
  amount: number;
  onlineAdvanceAmount: number | null;
  minSpendingTotal: number | null;
}

function normalizeQuantity(quantity: number | undefined): number {
  return Math.max(1, Math.min(10, Math.floor(quantity ?? 1)));
}

function normalizeExtras(extras: number | undefined): number {
  return Math.max(0, Math.floor(extras ?? 0));
}

function validateExtraGuests(category: TicketCategory, extras: number): void {
  if (extras === 0) return;

  if (category.kind !== "club_table" || !category.extra_guests_enabled) {
    throw new ExtraGuestsInvalidError("This category does not allow extra guests.");
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

function checkoutPricing(category: TicketCategory, extras: number): CheckoutPricing {
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

async function resolveGiftRecipientUserId(
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
  if (!friend) throw new GiftRecipientNotFoundError(normalizedEmail);

  return friend.id;
}

async function loadEventForTicket(sb: ServiceClient, ticket: Ticket): Promise<EventRow> {
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) throw new Error("Event not found.");
  return event;
}

async function assertEventPaymentReadiness(
  sb: ServiceClient,
  event: EventRow,
  amount: number,
): Promise<void> {
  if (amount <= 0 || !event.organization_id) return;
  const { data: organization, error } = await sb
    .from("organizations")
    .select("stripe_account_id, stripe_charges_enabled, stripe_details_submitted")
    .eq("id", event.organization_id)
    .maybeSingle<{
      stripe_account_id: string | null;
      stripe_charges_enabled: boolean;
      stripe_details_submitted: boolean;
    }>();
  if (error) throw error;
  assertOrganizationCanAcceptPaidSales(organization);
}

async function createPendingPurchase(
  sb: ServiceClient,
  params: {
    buyerUserId: string;
    ticket: Ticket;
    event: EventRow;
    category: TicketCategory;
    giftRecipientUserId: string | null;
    idempotencyKey?: string;
    extras: number;
    pricing: CheckoutPricing;
    salesChannel: SalesChannel;
    trackingOrigin: string | null;
  },
): Promise<Purchase> {
  const { data: purchase, error: purchaseError } = await sb
    .from("purchases")
    .insert({
      buyer_user_id: params.buyerUserId,
      event_id: params.event.id,
      ticket_id: params.ticket.id,
      amount: params.pricing.amount,
      currency: params.category.currency,
      status: "pending",
      checkout_idempotency_key: params.idempotencyKey,
      gift_recipient_user_id: params.giftRecipientUserId,
      extra_guests_count: params.extras,
      online_advance_amount: params.pricing.onlineAdvanceAmount,
      min_spending_total: params.pricing.minSpendingTotal,
      sales_channel: params.salesChannel,
      tracking_origin: params.trackingOrigin,
    })
    .select("*")
    .single<Purchase>();
  if (purchaseError || !purchase) {
    throw purchaseError ?? new Error("Purchase could not be created.");
  }

  return purchase;
}

export async function createPurchaseCheckout(params: {
  buyerUserId: string;
  categoryId: string;
  quantity?: number;
  extraGuestsCount?: number;
  giftRecipientEmail?: string | null;
  idempotencyKey?: string;
  successUrl: string;
  cancelUrl: string;
  salesChannel?: SalesChannel;
  trackingOrigin?: string | null;
}): Promise<PurchaseCheckoutResult> {
  const quantity = normalizeQuantity(params.quantity);
  const ticketIds: string[] = [];
  const purchaseIds: string[] = [];
  let compensated = false;
  const sb = createServiceClient();
  const extras = normalizeExtras(params.extraGuestsCount);

  const compensateStartedCheckout = async () => {
    if (compensated || (ticketIds.length === 0 && purchaseIds.length === 0)) return;
    compensated = true;
    await Promise.all(
      ticketIds.map((tid, i) =>
        settleFailedPurchase({ ticketId: tid, purchaseId: purchaseIds[i] }),
      ),
    );
  };

  try {
    if (params.idempotencyKey) {
      const { data: prior } = await sb
        .from("purchases")
        .select("id, status, provider_session_id")
        .eq("buyer_user_id", params.buyerUserId)
        .eq("checkout_idempotency_key", params.idempotencyKey)
        .limit(1)
        .maybeSingle<{ id: string; status: string; provider_session_id: string | null }>();
      if (prior?.provider_session_id) {
        const { stripe } = await import("@/lib/payments/stripe");
        const session = await stripe.checkout.sessions.retrieve(prior.provider_session_id);
        return {
          purchaseId: prior.id,
          checkoutUrl: session.url ?? params.cancelUrl,
          idempotentReplay: true,
        };
      }
    }

    const giftRecipientUserId = await resolveGiftRecipientUserId(
      sb,
      params.giftRecipientEmail,
    );

    const reservedTickets: Ticket[] = [];
    let category: TicketCategory | null = null;
    for (let i = 0; i < quantity; i++) {
      const reservation = await reserveTicket({
        categoryId: params.categoryId,
        buyerUserId: params.buyerUserId,
      });
      category = reservation.category;
      reservedTickets.push(reservation.ticket);
      ticketIds.push(reservation.ticket.id);
    }

    if (!category || reservedTickets.length === 0) {
      throw new Error("Ticket could not be reserved.");
    }

    validateExtraGuests(category, extras);
    const event = await loadEventForTicket(sb, reservedTickets[0]);
    const pricing = checkoutPricing(category, extras);
    await assertEventPaymentReadiness(sb, event, pricing.amount);

    for (const ticket of reservedTickets) {
      const purchase = await createPendingPurchase(sb, {
        buyerUserId: params.buyerUserId,
        ticket,
        event,
        category,
        giftRecipientUserId,
        idempotencyKey: params.idempotencyKey,
        extras,
        pricing,
        salesChannel: params.salesChannel ?? "mini_site",
        trackingOrigin: params.trackingOrigin ?? null,
      });
      purchaseIds.push(purchase.id);
    }

    const categoryLabel = category.name ?? "Ticket";
    const extraLabel = extras > 0 ? ` + ${extras} extra guest(s)` : "";
    const session = await createStripeCheckoutSession(
      {
        purchaseId: purchaseIds[0],
        amount: pricing.amount,
        quantity,
        currency: category.currency,
        eventName: event.name,
        categoryName: `${categoryLabel}${extraLabel}`,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      },
      {
        idempotencyKey: params.idempotencyKey,
      },
    );
    if (!session.url) {
      await expireStripeCheckoutSession(session.id);
      throw new Error("Stripe Checkout session did not include a URL.");
    }

    const { error: providerUpdateError } = await sb
      .from("purchases")
      .update({
        provider_session_id: session.id,
        payment_provider: "stripe",
      })
      .in("id", purchaseIds);
    if (providerUpdateError) {
      await compensateStartedCheckout();
      await expireStripeCheckoutSession(session.id);
      throw providerUpdateError;
    }

    return {
      purchaseId: purchaseIds[0],
      checkoutUrl: session.url,
      idempotentReplay: false,
    };
  } catch (error) {
    await compensateStartedCheckout();
    throw error;
  }
}
