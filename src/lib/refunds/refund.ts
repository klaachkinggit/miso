// Admin-triggered refund (demo).
//
// Policy:
//   - Mark ticket as refunded in DB.
//   - Refund issued through the mock PaymentProvider when a payment exists.
//   - Used tickets cannot be refunded.

import { audit } from "@/lib/audit";
import { paymentProvider } from "@/lib/payments";
import { createServiceClient } from "@/lib/supabase/service";
import type { Purchase, Ticket } from "@/types/db";

export async function refundTicket(params: {
  ticketId: string;
  adminUserId: string;
  reason?: string;
}) {
  const sb = createServiceClient();

  const { data: ticket } = await sb.from("tickets").select("*").eq("id", params.ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.status === "refunded") throw new Error("Already refunded");
  if (ticket.status === "used") throw new Error("Cannot refund a used ticket");

  // Find purchase (use original — for resold tickets we'd ideally refund the last
  // buyer; MVP refunds the latest paid purchase row).
  const { data: purchase } = await sb
    .from("purchases")
    .select("*")
    .eq("ticket_id", ticket.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Purchase>();

  let providerRefundId: string | null = null;
  if (purchase?.provider_payment_id) {
    try {
      const r = await paymentProvider().refund({
        providerPaymentId: purchase.provider_payment_id,
        reason: params.reason,
      });
      providerRefundId = r.providerRefundId;
    } catch (e) {
      console.error("Provider refund failed", e);
    }
  }

  await sb
    .from("tickets")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", ticket.id);

  if (purchase) {
    await sb.from("purchases").update({ status: "refunded" }).eq("id", purchase.id);
  }

  await audit({
    actorUserId: params.adminUserId,
    action: "ticket.refund",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: { provider_refund: providerRefundId, reason: params.reason },
  });
}
