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

export async function createPurchaseCheckout(params: {
  buyerUserId: string;
  categoryId: string;
  idempotencyKey?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<PurchaseCheckoutResult> {
  let ticketId: string | undefined;
  let purchaseId: string | undefined;
  const sb = createServiceClient();

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

    const { ticket, category } = await reserveTicket({
      categoryId: params.categoryId,
      buyerUserId: params.buyerUserId,
    });
    ticketId = ticket.id;

    const [{ data: event }, { data: cat }] = await Promise.all([
      sb.from("events").select("*").eq("id", ticket.event_id).single<EventRow>(),
      sb.from("ticket_categories").select("*").eq("id", ticket.category_id).single<TicketCategory>(),
    ]);
    if (!event) throw new Error("Event not found.");

    const { data: purchase, error: purchaseError } = await sb
      .from("purchases")
      .insert({
        buyer_user_id: params.buyerUserId,
        event_id: event.id,
        ticket_id: ticket.id,
        amount: category.price,
        currency: category.currency,
        status: "pending",
        checkout_idempotency_key: params.idempotencyKey,
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) {
      throw purchaseError ?? new Error("Purchase could not be created.");
    }
    purchaseId = purchase.id;

    const session = await createStripeCheckoutSession({
      purchaseId: purchase.id,
      amount: Number(category.price),
      currency: category.currency,
      eventName: event.name,
      categoryName: cat?.name ?? "Ticket",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    }, {
      idempotencyKey: params.idempotencyKey,
    });

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
