import { NextResponse, type NextRequest } from "next/server";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { canManageEvent } from "@/lib/organizations/auth";
import { settlePaidPurchase } from "@/lib/payments/settlement";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Purchase } from "@/types/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireOrganizerWorkspace();
  const { id } = await params;
  const sb = createServiceClient();
  const { data: purchase } = await sb
    .from("purchases")
    .select("*")
    .eq("id", id)
    .single<Purchase>();
  const eventId = purchase?.event_id ?? "";
  const target = new URL(
    eventId ? `/admin/events/${eventId}` : "/admin",
    request.url,
  );

  if (!purchase) {
    target.searchParams.set("error", "Purchase not found.");
    return NextResponse.redirect(target);
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", purchase.event_id)
    .maybeSingle<EventRow>();
  if (!event || !(await canManageEvent(admin, event))) {
    target.searchParams.set(
      "error",
      "You can only manage events for your organization.",
    );
    return NextResponse.redirect(new URL("/admin/events", request.url));
  }

  try {
    await settlePaidPurchase({ purchaseId: purchase.id });
  } catch (error) {
    console.error("[admin] retry mint failed:", error);
    target.searchParams.set("error", "Retry fulfillment failed.");
  }

  return NextResponse.redirect(target);
}
