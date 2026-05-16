// Admin-triggered refund (demo).
//
// Policy:
//   - Mark ticket as refunded in DB.
//   - Refund issued through mock payment when a payment exists.
//   - Used tickets cannot be refunded.

import { audit } from "@/lib/audit";
import { creditRefundBalance } from "@/lib/balances/ledger";
import { markPurchaseRefunded } from "@/lib/payments/settlement";
import { createServiceClient } from "@/lib/supabase/service";
import { markTicketRefunded } from "@/lib/tickets/lifecycle";
import type { Purchase, ResaleListing, Ticket } from "@/types/db";

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

  const holderUserId = ticket.owner_user_id;

  const { data: resale } = holderUserId
    ? await sb
        .from("resale_listings")
        .select("*")
        .eq("ticket_id", ticket.id)
        .eq("buyer_user_id", holderUserId)
        .eq("status", "sold")
        .order("sold_at", { ascending: false })
        .limit(1)
        .maybeSingle<ResaleListing>()
    : { data: null };

  const { data: purchase } = await sb
    .from("purchases")
    .select("*")
    .eq("ticket_id", ticket.id)
    .eq("status", "paid")
    .eq("buyer_user_id", holderUserId ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Purchase>();

  const refundAmount = resale?.price ?? purchase?.amount;
  const refundCurrency = resale?.currency ?? purchase?.currency;

  // Credit first — the RPC dedups on (profile, currency, movement,
  // ref_type, ref_id) so retrying is a no-op. If we flipped the ticket
  // first and then the credit failed, retry would hit "Cannot refund
  // this ticket in its current state" and the buyer would be left
  // refund-less with status=refunded. Crediting first makes the whole
  // chain idempotent: credit → markTicketRefunded → markPurchaseRefunded
  // can be re-driven safely on any partial failure.
  if (holderUserId && refundAmount && refundCurrency && Number(refundAmount) > 0) {
    await creditRefundBalance({
      ticketId: ticket.id,
      holderUserId,
      amount: refundAmount,
      currency: refundCurrency,
    });
  }

  await markTicketRefunded(ticket.id);

  if (purchase && !resale) {
    await markPurchaseRefunded(purchase.id);
  }

  await audit({
    actorUserId: params.adminUserId,
    action: "ticket.refund",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: {
      holder_user_id: holderUserId,
      refund_amount: refundAmount,
      refund_currency: refundCurrency,
      reason: params.reason,
    },
  });
}
