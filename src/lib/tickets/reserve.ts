// Reservation pattern for primary sales.
// On checkout init: find an available ticket in the category, mark reserved 10 min.
// On webhook success: flip reserved → sold + mint.
// On failure/expiry: lazy release on next reservation attempt.

import { createServiceClient } from "@/lib/supabase/service";
import type { Ticket, TicketCategory } from "@/types/db";

const RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function reserveTicket(params: {
  categoryId: string;
  buyerUserId: string;
}): Promise<{ ticket: Ticket; category: TicketCategory }> {
  const sb = createServiceClient();

  // Fetch category (validate sales_enabled at event level).
  const { data: category, error: catErr } = await sb
    .from("ticket_categories")
    .select("*, events(sales_enabled, status)")
    .eq("id", params.categoryId)
    .single<TicketCategory & { events: { sales_enabled: boolean; status: string } }>();
  if (catErr || !category) throw new Error("Category not found");
  if (!category.events.sales_enabled || category.events.status !== "published") {
    throw new Error("Sales not open");
  }
  if (category.sold_count >= category.supply) throw new Error("Sold out");

  // Find candidate: available, OR reserved-but-expired.
  const now = new Date().toISOString();
  const { data: candidate, error: tErr } = await sb
    .from("tickets")
    .select("*")
    .eq("category_id", params.categoryId)
    .or(`status.eq.available,and(status.eq.reserved,reserved_until.lt.${now})`)
    .order("serial_number", { ascending: true })
    .limit(1)
    .maybeSingle<Ticket>();
  if (tErr) throw tErr;
  if (!candidate) throw new Error("No tickets available");

  const reservedUntil = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();

  // Atomic conditional update — guard with prior status to avoid race.
  const { data: reserved, error: updErr } = await sb
    .from("tickets")
    .update({
      status: "reserved",
      reserved_until: reservedUntil,
      owner_user_id: params.buyerUserId,
    })
    .eq("id", candidate.id)
    .in("status", ["available", "reserved"])
    .lt("reserved_until", new Date(Date.now() + 1).toISOString())
    .select("*")
    .single<Ticket>();

  // If guarded update failed because someone else grabbed it, retry with simpler logic.
  if (updErr || !reserved) {
    // Fallback: try plain available row.
    const { data: retry } = await sb
      .from("tickets")
      .update({
        status: "reserved",
        reserved_until: reservedUntil,
        owner_user_id: params.buyerUserId,
      })
      .eq("id", candidate.id)
      .eq("status", "available")
      .select("*")
      .single<Ticket>();
    if (!retry) throw new Error("Ticket no longer available, retry");
    return { ticket: retry, category };
  }

  return { ticket: reserved, category };
}

export async function releaseReservation(ticketId: string) {
  const sb = createServiceClient();
  await sb
    .from("tickets")
    .update({
      status: "available",
      reserved_until: null,
      owner_user_id: null,
    })
    .eq("id", ticketId)
    .eq("status", "reserved");
}
