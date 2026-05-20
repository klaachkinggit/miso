import { computeClubTablePricing } from "@/lib/payments/pricing";
import { settleFailedPurchase } from "@/lib/payments/settlement";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
} from "@/lib/payments/stripe";
import { DomainError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import type { EventRow, Purchase, TicketCategory } from "@/types/db";

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

export async function createPurchaseCheckout(params: {
  buyerUserId: string;
  categoryId: string;
  quantity?: number;
  extraGuestsCount?: number;
  giftRecipientEmail?: string | null;
  idempotencyKey?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<PurchaseCheckoutResult> {
  const quantity = Math.max(1, Math.min(10, Math.floor(params.quantity ?? 1)));
  const ticketIds: string[] = [];
  const purchaseIds: string[] = [];
  let compensated = false;
  const sb = createServiceClient();
  const extras = Math.max(0, Math.floor(params.extraGuestsCount ?? 0));
  
  const compensateStartedCheckout = async () => {
    if (compensated || (ticketIds.length === 0 && purchaseIds.length === 0)) return;
    compensated = true;
    await Promise.all(
      ticketIds.map((tid, i) =>
        settleFailedPurchase({ ticketId: tid, purchaseId: purchaseIds[i] })
      )
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

    let categoryInfo: TicketCategory | undefined;
    let eventInfo: EventRow | undefined;
    let amount: number = 0;
    let onlineAdvanceAmount: number | null = null;
    let minSpendingTotal: number | null = null;

    for (let i = 0; i < quantity; i++) {
      const { ticket, category } = await reserveTicket({
        categoryId: params.categoryId,
        buyerUserId: params.buyerUserId,
      });
      ticketIds.push(ticket.id);

      if (i === 0) {
        categoryInfo = category;
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
        eventInfo = event;
        categoryInfo = cat as TicketCategory;

        if (categoryInfo.kind === "club_table") {
          const pricing = computeClubTablePricing(categoryInfo, extras);
          amount = pricing.amount;
          onlineAdvanceAmount = pricing.onlineAdvanceAmount;
          minSpendingTotal = pricing.minSpendingTotal;
        } else {
          amount = Number(categoryInfo.price);
        }
      }

      const { data: purchase, error: purchaseError } = await sb
        .from("purchases")
        .insert({
          buyer_user_id: params.buyerUserId,
          event_id: eventInfo!.id,
          ticket_id: ticket.id,
          amount,
          currency: categoryInfo!.currency,
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
      purchaseIds.push(purchase.id);
    }

    const categoryLabel = categoryInfo?.name ?? "Ticket";
    const extraLabel = extras > 0 ? ` + ${extras} extra guest(s)` : "";
    const session = await createStripeCheckoutSession(
      {
        purchaseId: purchaseIds[0],
        amount,
        quantity,
        currency: categoryInfo!.currency,
        eventName: eventInfo!.name,
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
