// Admin-triggered refund (demo).
//
// Policy:
//   - Mark ticket as refunded in DB.
//   - Refund issued through Stripe when a checkout session exists.
//   - Used tickets cannot be refunded.

import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/api/errors";
import { markPurchaseRefunded } from "@/lib/payments/settlement";
import { refundStripeSession } from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { markTicketRefunded } from "@/lib/tickets/lifecycle";
import { eventHasAvailability, notifyWaitlistHead } from "@/lib/waitlist";
import type { Purchase, ResaleListing, Ticket } from "@/types/db";

export async function refundTicket(params: {
  ticketId: string;
  adminUserId: string;
  reason?: string;
}) {
  const sb = createServiceClient();

  const { data: ticket } = await sb.from("tickets").select("*").eq("id", params.ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.status === "refunded") throw new DomainError("Already refunded");
  if (ticket.status === "used") throw new DomainError("Cannot refund a used ticket");

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
  const providerSessionId = resale?.provider_session_id ?? purchase?.provider_session_id;

  if (providerSessionId) {
    await refundStripeSession(providerSessionId);
  }

  await markTicketRefunded(ticket.id);

  if (purchase && !resale) {
    await markPurchaseRefunded(purchase.id);
  }

  // A refund frees inventory — but only notify once markTicketRefunded has
  // genuinely returned a purchasable seat. Gate on eventHasAvailability so a
  // refund that did not actually free inventory (e.g. sold_count already 0)
  // never sends a hollow "a ticket opened up" to a still-sold-out page.
  if (await eventHasAvailability({ eventId: ticket.event_id })) {
    await notifyWaitlistHead({ eventId: ticket.event_id, source: "refund" });
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
