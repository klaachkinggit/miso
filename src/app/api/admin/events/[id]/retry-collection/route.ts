import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { demoCollectionAddress, isDemoMode } from "@/lib/demo";
import { createEventCollection } from "@/lib/solana/collection";
import { uploadMetadata } from "@/lib/solana/metadata";
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

  try {
    if (isDemoMode()) {
      await sb
        .from("events")
        .update({ solana_collection_address: demoCollectionAddress(event.id) })
        .eq("id", event.id);
      await audit({
        actorUserId: admin.id,
        action: "event.collection_demo_retry",
        entityType: "event",
        entityId: event.id,
        metadata: { collection: demoCollectionAddress(event.id) },
      });
      return NextResponse.redirect(target);
    }

    const metadataUri = await uploadMetadata(`${event.id}/collection.json`, {
      name: event.name,
      description: event.description ?? `${event.name} ticket collection`,
      image: event.image_url ?? "",
      external_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/events/${event.id}`,
      attributes: [
        { trait_type: "event_id", value: event.id },
        { trait_type: "venue", value: event.venue_name },
        { trait_type: "city", value: event.city },
        { trait_type: "date", value: event.date },
      ],
    });
    const collection = await createEventCollection({ eventName: event.name, metadataUri });
    await sb.from("events").update({ solana_collection_address: collection.address }).eq("id", event.id);
    await audit({
      actorUserId: admin.id,
      action: "event.collection_retry",
      entityType: "event",
      entityId: event.id,
      metadata: { collection: collection.address, tx: collection.signature },
    });
  } catch (error) {
    target.searchParams.set("error", error instanceof Error ? error.message : "Collection retry failed.");
  }

  return NextResponse.redirect(target);
}
