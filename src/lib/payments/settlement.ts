import { fulfillReservedTicket, releaseReservation } from "@/lib/tickets/lifecycle";
import {
  compensatePurchaseDebit,
  debitPurchaseBalance,
} from "@/lib/balances/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import type { Purchase, Ticket } from "@/types/db";

export async function settlePaidPurchase(params: { purchaseId: string }): Promise<void> {
  const sb = createServiceClient();
  const { data: purchase } = await sb
    .from("purchases")
    .select("*")
    .eq("id", params.purchaseId)
    .single<Purchase>();
  if (!purchase) throw new Error("Purchase not found");

  const { data: ticket } = await sb
    .from("tickets")
    .select("id, status, original_purchase_id")
    .eq("id", purchase.ticket_id)
    .maybeSingle<Pick<Ticket, "id" | "status" | "original_purchase_id">>();
  if (ticket?.status === "sold" && ticket.original_purchase_id === purchase.id) {
    if (purchase.status !== "paid") {
      await sb
        .from("purchases")
        .update({
          status: "paid",
          paid_at: purchase.paid_at ?? new Date().toISOString(),
        })
        .eq("id", purchase.id);
    }
    return;
  }

  const purchaseAmount = Number(purchase.amount);
  if (purchaseAmount > 0) {
    await debitPurchaseBalance({
      purchaseId: purchase.id,
      buyerUserId: purchase.buyer_user_id,
      amount: purchase.amount,
      currency: purchase.currency,
    });
  }

  try {
    await fulfillReservedTicket({
      ticketId: purchase.ticket_id,
      buyerUserId: purchase.buyer_user_id,
      purchaseId: purchase.id,
    });
  } catch (error) {
    if (purchaseAmount > 0) {
      await compensatePurchaseDebit({
        purchaseId: purchase.id,
        buyerUserId: purchase.buyer_user_id,
        amount: purchase.amount,
        currency: purchase.currency,
      });
    }
    await settleFailedPurchase({ purchaseId: purchase.id, ticketId: purchase.ticket_id });
    throw error;
  }

  const { error } = await sb
    .from("purchases")
    .update({
      status: "paid",
      paid_at: purchase.paid_at ?? new Date().toISOString(),
    })
    .eq("id", purchase.id);
  if (error) throw error;
}

export async function settleFailedPurchase(params: {
  purchaseId?: string;
  ticketId?: string;
}): Promise<void> {
  const sb = createServiceClient();
  let canReleaseReservation = true;

  if (params.purchaseId) {
    const { data: purchase } = await sb
      .from("purchases")
      .select("status")
      .eq("id", params.purchaseId)
      .maybeSingle<Pick<Purchase, "status">>();
    canReleaseReservation = purchase?.status !== "paid";
    if (purchase && purchase.status !== "paid") {
      await sb
        .from("purchases")
        .update({ status: "failed" })
        .eq("id", params.purchaseId);
    }
  }

  if (params.ticketId && canReleaseReservation) {
    await releaseReservation(params.ticketId);
  }
}

export async function markPurchaseRefunded(purchaseId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("purchases")
    .update({ status: "refunded" })
    .eq("id", purchaseId);
  if (error) throw error;
}
