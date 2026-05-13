import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { settlePaidPurchase } from "@/lib/payments/settlement";
import { createServiceClient } from "@/lib/supabase/service";
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
    await settlePaidPurchase({ purchaseId: purchase.id });
  } catch (error) {
    target.searchParams.set("error", error instanceof Error ? error.message : "Retry fulfillment failed.");
  }

  return NextResponse.redirect(target);
}
