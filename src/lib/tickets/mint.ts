// Post-payment mint flow. Called from the payments webhook (or the Mock
// provider inline) after the buyer's payment has been confirmed.

import { createServiceClient } from "@/lib/supabase/service";
import { mintTicketNft } from "@/lib/solana/mint";
import { uploadMetadata } from "@/lib/solana/metadata";
import { ensureCustodialWallet } from "@/lib/solana/wallet";
import { audit } from "@/lib/audit";
import { demoMetadataUri, isDemoMode } from "@/lib/demo";
import type { Ticket, EventRow, TicketCategory } from "@/types/db";

export class StaleReservationError extends Error {
  constructor(message = "Reservation is stale or no longer belongs to this buyer") {
    super(message);
    this.name = "StaleReservationError";
  }
}

export async function fulfillPurchase(params: {
  ticketId: string;
  buyerUserId: string;
  purchaseId: string;
}) {
  const sb = createServiceClient();

  // Load context.
  const { data: ticket } = await sb.from("tickets").select("*").eq("id", params.ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket missing");
  if (
    ticket.status !== "reserved" ||
    ticket.owner_user_id !== params.buyerUserId ||
    !ticket.reserved_until ||
    new Date(ticket.reserved_until).getTime() < Date.now()
  ) {
    throw new StaleReservationError();
  }

  const { data: event } = await sb.from("events").select("*").eq("id", ticket.event_id).single<EventRow>();
  if (!event) throw new Error("Event missing");
  if (!event.solana_collection_address) throw new Error("Event has no collection");
  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", ticket.category_id)
    .single<TicketCategory>();
  if (!category) throw new Error("Category missing");

  // Ensure buyer has a custodial wallet.
  const { address: buyerWallet } = await ensureCustodialWallet(params.buyerUserId);

  // Upload metadata JSON (public, no PII).
  const metadata = {
    name: `${event.name} — #${ticket.serial_number}`,
    description: `${category.name} ticket to ${event.name} at ${event.venue_name}, ${event.city}.`,
    image: event.image_url ?? "",
    external_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/events/${event.id}`,
    attributes: [
      { trait_type: "event_id", value: event.id },
      { trait_type: "ticket_id", value: ticket.id },
      { trait_type: "category", value: category.name },
      { trait_type: "serial_number", value: ticket.serial_number },
      { trait_type: "venue", value: event.venue_name },
      { trait_type: "city", value: event.city },
      { trait_type: "date", value: event.date },
      { trait_type: "status", value: "valid" },
    ],
  };
  const metadataUri = isDemoMode()
    ? demoMetadataUri("ticket", ticket.id)
    : await uploadMetadata(`${event.id}/${ticket.id}.json`, metadata);

  // Mint.
  const demoAssetAddress = `demo_asset_${ticket.id}`;
  const { assetAddress, signature } = isDemoMode()
    ? { assetAddress: demoAssetAddress, signature: "demo-mode" }
    : await mintTicketNft({
        collectionAddress: event.solana_collection_address,
        buyerWallet,
        name: metadata.name,
        metadataUri,
        attributes: metadata.attributes.map((a) => ({
          key: a.trait_type,
          value: String(a.value),
        })),
      });

  // Flip ticket → sold only if the original reservation still belongs to this buyer.
  const { data: updatedTicket, error: ticketUpdateError } = await sb
    .from("tickets")
    .update({
      status: "sold",
      owner_user_id: params.buyerUserId,
      owner_wallet_address: buyerWallet,
      nft_asset_address: assetAddress,
      metadata_uri: metadataUri,
      image_url: event.image_url,
      reserved_until: null,
      minted_at: new Date().toISOString(),
      original_purchase_id: params.purchaseId,
    })
    .eq("id", ticket.id)
    .eq("status", "reserved")
    .eq("owner_user_id", params.buyerUserId)
    .select("id")
    .maybeSingle();

  if (ticketUpdateError) throw ticketUpdateError;
  if (!updatedTicket) throw new StaleReservationError();

  await sb
    .from("ticket_categories")
    .update({ sold_count: category.sold_count + 1 })
    .eq("id", category.id);

  await sb
    .from("purchases")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", params.purchaseId);

  await audit({
    actorUserId: params.buyerUserId,
    action: "ticket.mint",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: { asset: assetAddress, tx: signature, purchase: params.purchaseId },
  });

  return { assetAddress, signature };
}
