import { settleFailedPurchase } from "@/lib/payments/settlement";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
} from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import type { EventRow, Purchase, TicketCategory } from "@/types/db";

export interface PurchaseCheckoutResult {
  purchaseId: string;
  checkoutUrl: string;
  idempotentReplay: boolean;
}

export class GiftRecipientNotFoundError extends Error {
  constructor(email: string) {
    super(`No MISO account is registered for ${email}.`);
    this.name = "GiftRecipientNotFoundError";
  }
}

export class ExtraGuestsInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtraGuestsInvalidError";
  }
}

export async function createPurchaseCheckout(params: {
  buyerUserId: string;
  categoryId: string;
  extraGuestsCount?: number;
  giftRecipientEmail?: string | null;
  idempotencyKey?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<PurchaseCheckoutResult> {
  let ticketId: string | undefined;
  let purchaseId: string | undefined;
  const sb = createServiceClient();
  const extras = Math.max(0, Math.floor(params.extraGuestsCount ?? 0));

  try {
    if (params.idempotencyKey) {
      const { data: prior } = await sb
        .from("purchases")
        .select("id, status, provider_session_id")
        .eq("buyer_user_id", params.buyerUserId)
        .eq("checkout_idempotency_key", params.idempotencyKey)
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

    // Resolve gift recipient against profiles BEFORE reserving inventory.
    // Strict guardrail: block the transaction if the email is not a
    // registered MISO account (no auto-invite — friend must exist).
    let giftRecipientUserId: string | null = null;
    if (params.giftRecipientEmail) {
      const email = params.giftRecipientEmail.toLowerCase();
      const { data: friend } = await sb
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle<{ id: string; email: string }>();
      if (!friend) throw new GiftRecipientNotFoundError(email);
      giftRecipientUserId = friend.id;
    }

    const { ticket, category } = await reserveTicket({
      categoryId: params.categoryId,
      buyerUserId: params.buyerUserId,
    });
    ticketId = ticket.id;

    // Validate extras against category configuration.
    if (extras > 0) {
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

    const [{ data: event }, { data: cat }] = await Promise.all([
      sb.from("events").select("*").eq("id", ticket.event_id).single<EventRow>(),
      sb.from("ticket_categories").select("*").eq("id", ticket.category_id).single<TicketCategory>(),
    ]);
    if (!event) throw new Error("Event not found.");

    // Pricing:
    //  - standard: full price online
    //  - club_table: online_advance + extras * price_per_extra_guest
    let amount: number;
    let onlineAdvanceAmount: number | null = null;
    let minSpendingTotal: number | null = null;
    if (category.kind === "club_table") {
      const advance = Number(category.online_advance ?? category.price);
      const extraPrice = Number(category.price_per_extra_guest ?? 0);
      amount = advance + extras * extraPrice;
      onlineAdvanceAmount = amount;
      minSpendingTotal = category.min_spending != null ? Number(category.min_spending) : null;
    } else {
      amount = Number(category.price);
    }

    const { data: purchase, error: purchaseError } = await sb
      .from("purchases")
      .insert({
        buyer_user_id: params.buyerUserId,
        event_id: event.id,
        ticket_id: ticket.id,
        amount,
        currency: category.currency,
        status: "pending",
        checkout_idempotency_key: params.idempotencyKey,
        gift_recipient_user_id: giftRecipientUserId,
        extra_guests_count: extras,
        online_advance_amount: onlineAdvanceAmount,
        min_spending_total: minSpendingTotal,
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) {
      throw purchaseError ?? new Error("Purchase could not be created.");
    }
    purchaseId = purchase.id;

    const categoryLabel = cat?.name ?? "Ticket";
    const extraLabel = extras > 0 ? ` + ${extras} extra guest(s)` : "";
    const session = await createStripeCheckoutSession(
      {
        purchaseId: purchase.id,
        amount,
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

    const { error: providerUpdateError } = await sb
      .from("purchases")
      .update({
        provider_session_id: session.id,
        payment_provider: "stripe",
      })
      .eq("id", purchase.id);
    if (providerUpdateError) {
      await settleFailedPurchase({ ticketId, purchaseId });
      await expireStripeCheckoutSession(session.id);
      throw providerUpdateError;
    }

    return {
      purchaseId: purchase.id,
      checkoutUrl: session.url!,
      idempotentReplay: false,
    };
  } catch (error) {
    await settleFailedPurchase({ ticketId, purchaseId });
    throw error;
  }
}
