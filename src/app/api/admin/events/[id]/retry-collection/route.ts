import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assignDemoCollection } from "@/lib/events/setup";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sb = createServiceClient();
  const { data: event } = await sb.from("events").select("*").eq("id", id).single<EventRow>();
  const target = new URL(`/admin/events/${id}`, request.url);

  if (!event) {
    target.searchParams.set("error", "Event not found.");
    return NextResponse.redirect(target);
  }

  if (event.solana_collection_address) {
    return NextResponse.redirect(target);
  }

  await assignDemoCollection({ eventId: event.id, adminUserId: admin.id });

  return NextResponse.redirect(target);
}
