import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fulfillPurchase } from "@/lib/tickets/mint";
import type { Purchase } from "@/types/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sb = createServiceClient();
  const { data: purchase } = await sb.from("purchases").select("*").eq("id", id).single<Purchase>();
  const eventId = purchase?.event_id ?? "";
  const target = new URL(eventId ? `/admin/events/${eventId}` : "/admin", request.url);

  if (!purchase) {
    target.searchParams.set("error", "Purchase not found.");
    return NextResponse.redirect(target);
  }

  try {
    await fulfillPurchase({
      ticketId: purchase.ticket_id,
      buyerUserId: purchase.buyer_user_id,
      purchaseId: purchase.id,
    });
  } catch (error) {
    target.searchParams.set("error", error instanceof Error ? error.message : "Retry mint failed.");
  }

  return NextResponse.redirect(target);
}
