import {
  FulfillmentPendingError,
  settleFailedPurchase,
  settlePaidPurchase,
} from "@/lib/payments/settlement";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import type { EventRow, Purchase } from "@/types/db";

export interface PurchaseCheckoutResult {
  purchaseId: string;
  status?: string;
  idempotentReplay: boolean;
}

export async function createPurchaseCheckout(params: {
  buyerUserId: string;
  categoryId: string;
  idempotencyKey?: string;
}): Promise<PurchaseCheckoutResult> {
  let ticketId: string | undefined;
  let purchaseId: string | undefined;
  const sb = createServiceClient();

  try {
    if (params.idempotencyKey) {
      const { data: prior } = await sb
        .from("purchases")
        .select("id, status")
        .eq("buyer_user_id", params.buyerUserId)
        .eq("provider_session_id", params.idempotencyKey)
        .maybeSingle<{ id: string; status: string }>();
      if (prior) {
        return {
          purchaseId: prior.id,
          status: prior.status,
          idempotentReplay: true,
        };
      }
    }

    const { ticket, category } = await reserveTicket({
      categoryId: params.categoryId,
      buyerUserId: params.buyerUserId,
    });
    ticketId = ticket.id;

    const { data: event } = await sb
      .from("events")
      .select("*")
      .eq("id", ticket.event_id)
      .single<EventRow>();
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
        provider_session_id: params.idempotencyKey ?? null,
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) {
      throw purchaseError ?? new Error("Purchase could not be created.");
    }
    purchaseId = purchase.id;

    await settlePaidPurchase({ purchaseId: purchase.id });

    return { purchaseId: purchase.id, idempotentReplay: false };
  } catch (error) {
    if (error instanceof FulfillmentPendingError) throw error;
    await settleFailedPurchase({ ticketId, purchaseId });
    throw error;
  }
}
