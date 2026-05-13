import { fulfillReservedTicket, releaseReservation } from "@/lib/tickets/lifecycle";
import { createServiceClient } from "@/lib/supabase/service";
import type { Purchase, Ticket } from "@/types/db";

export async function settlePaidPurchase(params: {
  purchaseId: string;
  providerPaymentId?: string | null;
}): Promise<void> {
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
    if (purchase.status !== "paid" || params.providerPaymentId) {
      await sb
        .from("purchases")
        .update({
          status: "paid",
          paid_at: purchase.paid_at ?? new Date().toISOString(),
          provider_payment_id: params.providerPaymentId ?? purchase.provider_payment_id,
        })
        .eq("id", purchase.id);
    }
    return;
  }

  if (purchase.status !== "paid" || params.providerPaymentId) {
    const { error } = await sb
      .from("purchases")
      .update({
        status: "paid",
        paid_at: purchase.paid_at ?? new Date().toISOString(),
        provider_payment_id: params.providerPaymentId ?? purchase.provider_payment_id,
      })
      .eq("id", purchase.id);
    if (error) throw error;
  }

  await fulfillReservedTicket({
    ticketId: purchase.ticket_id,
    buyerUserId: purchase.buyer_user_id,
    purchaseId: purchase.id,
  });
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
