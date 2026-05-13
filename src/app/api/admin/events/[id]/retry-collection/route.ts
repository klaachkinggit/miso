import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
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

  const collectionAddress = `demo_collection_${event.id}`;
  await sb
    .from("events")
    .update({ solana_collection_address: collectionAddress })
    .eq("id", event.id);
  await audit({
    actorUserId: admin.id,
    action: "event.collection_demo_retry",
    entityType: "event",
    entityId: event.id,
    metadata: { collection: collectionAddress },
  });

  return NextResponse.redirect(target);
}
