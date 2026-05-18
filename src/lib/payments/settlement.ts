import { fulfillReservedTicket, releaseReservation } from "@/lib/tickets/lifecycle";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
} from "@/lib/chain/ops";
import { createServiceClient } from "@/lib/supabase/service";
import { TransactionTimeoutError } from "@/lib/thirdweb/transactions";
import { audit } from "@/lib/audit";
import type { Purchase, Ticket } from "@/types/db";

export class FulfillmentPendingError extends Error {
  constructor(readonly purchaseId: string, readonly cause: TransactionTimeoutError) {
    super(`Fulfillment for purchase ${purchaseId} is pending on chain — do not release.`);
    this.name = "FulfillmentPendingError";
  }
}

export async function settlePaidPurchase(params: { purchaseId: string }): Promise<void> {
  const sb = createServiceClient();
  const { data: purchase } = await sb
    .from("purchases")
    .select("*")
    .eq("id", params.purchaseId)
    .single<Purchase>();
  if (!purchase) throw new Error("Purchase not found");

  if (purchase.status === "failed" || purchase.status === "refunded") {
    throw new Error(
      `Purchase ${purchase.id} is ${purchase.status} and cannot be re-settled.`,
    );
  }

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

  try {
    await fulfillReservedTicket({
      ticketId: purchase.ticket_id,
      buyerUserId: purchase.buyer_user_id,
      purchaseId: purchase.id,
    });
  } catch (error) {
    const nonCompensatable =
      error instanceof TransactionTimeoutError ||
      error instanceof ChainOpInFlightError ||
      error instanceof ChainOpRepairError ||
      (error instanceof Error &&
        (error.name === "TransactionTimeoutError" ||
          error.name === "ChainOpInFlightError" ||
          error.name === "ChainOpRepairError"));
    if (nonCompensatable) {
      await sb
        .from("purchases")
        .update({ status: "pending" })
        .eq("id", purchase.id);
      await audit({
        actorUserId: purchase.buyer_user_id,
        action: "purchase.fulfillment_pending",
        entityType: "purchase",
        entityId: purchase.id,
        metadata: {
          ticket_id: purchase.ticket_id,
          reason: error instanceof Error ? error.message : "pending",
          state:
            error instanceof ChainOpRepairError ? "repair_needed" : "in_flight",
        },
      });
      throw new FulfillmentPendingError(
        purchase.id,
        error as TransactionTimeoutError,
      );
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
