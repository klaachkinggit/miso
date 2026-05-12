// Internal resale marketplace.
// Custodial-only in MVP. External-wallet sellers see "transfer to platform first" notice.
// TODO V2: trustless on-chain marketplace.

import { createServiceClient } from "@/lib/supabase/service";
import { marketplaceTransfer } from "@/lib/solana/marketplace";
import { ensureCustodialWallet } from "@/lib/solana/wallet";
import { audit } from "@/lib/audit";
import type { Ticket, EventRow, TicketCategory, ResaleListing, Wallet } from "@/types/db";

const INVALID_FOR_RESALE = new Set([
  "used",
  "refunded",
  "refund_pending",
  "canceled",
  "expired",
]);

export async function createResaleListing(params: {
  ticketId: string;
  sellerUserId: string;
  price: number;
}): Promise<ResaleListing> {
  const sb = createServiceClient();

  const { data: ticket } = await sb.from("tickets").select("*").eq("id", params.ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.owner_user_id !== params.sellerUserId) throw new Error("Not ticket owner");
  if (INVALID_FOR_RESALE.has(ticket.status)) {
    throw new Error(`Ticket cannot be listed (status: ${ticket.status})`);
  }
  if (ticket.status !== "sold") throw new Error(`Ticket not listable (status: ${ticket.status})`);

  const { data: event } = await sb.from("events").select("*").eq("id", ticket.event_id).single<EventRow>();
  if (!event?.resale_enabled) throw new Error("Resale not enabled for this event");
  if (event.status === "canceled") throw new Error("Event canceled");
  if (new Date(event.date).getTime() < Date.now()) throw new Error("Event already passed");

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", ticket.category_id)
    .single<TicketCategory>();
  if (!category?.resale_enabled) throw new Error("Resale not enabled for this category");
  if (category.max_resale_price && params.price > parseFloat(category.max_resale_price)) {
    throw new Error(`Resale price exceeds max (${category.max_resale_price})`);
  }

  const { data: wallet } = await sb
    .from("wallets")
    .select("wallet_type")
    .eq("user_id", params.sellerUserId)
    .eq("is_primary", true)
    .single<Pick<Wallet, "wallet_type">>();
  if (wallet?.wallet_type !== "custodial") {
    throw new Error(
      "Resale of external-wallet tickets not supported in MVP. Transfer to platform first."
    );
  }

  const { data: listing, error } = await sb
    .from("resale_listings")
    .insert({
      ticket_id: ticket.id,
      seller_user_id: params.sellerUserId,
      price: params.price,
      currency: category.currency,
      status: "active",
    })
    .select("*")
    .single<ResaleListing>();
  if (error || !listing) throw error ?? new Error("Listing creation failed");

  await sb.from("tickets").update({ status: "listed", current_listing_id: listing.id }).eq("id", ticket.id);

  await audit({
    actorUserId: params.sellerUserId,
    action: "listing.create",
    entityType: "resale_listing",
    entityId: listing.id,
    metadata: { ticket_id: ticket.id, price: params.price },
  });

  return listing;
}

export async function cancelResaleListing(params: {
  listingId: string;
  sellerUserId: string;
}) {
  const sb = createServiceClient();

  const { data: listing } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", params.listingId)
    .single<ResaleListing>();
  if (!listing) throw new Error("Listing not found");
  if (listing.seller_user_id !== params.sellerUserId) throw new Error("Not listing owner");
  if (listing.status !== "active") throw new Error(`Listing not cancelable (status: ${listing.status})`);

  await sb
    .from("resale_listings")
    .update({ status: "canceled" })
    .eq("id", listing.id)
    .eq("status", "active");

  await sb
    .from("tickets")
    .update({ status: "sold", current_listing_id: null })
    .eq("id", listing.ticket_id)
    .eq("status", "listed");

  await audit({
    actorUserId: params.sellerUserId,
    action: "listing.cancel",
    entityType: "resale_listing",
    entityId: listing.id,
    metadata: { ticket_id: listing.ticket_id },
  });
}

export async function fulfillResale(params: {
  listingId: string;
  buyerUserId: string;
}) {
  const sb = createServiceClient();

  const { data: listing } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", params.listingId)
    .single<ResaleListing>();
  if (!listing) throw new Error("Listing not found");
  if (listing.status !== "active") throw new Error("Listing not active");

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", listing.ticket_id)
    .single<Ticket>();
  if (!ticket?.nft_asset_address) throw new Error("Ticket NFT missing");
  if (INVALID_FOR_RESALE.has(ticket.status)) {
    throw new Error(`Ticket cannot be transferred (status: ${ticket.status})`);
  }

  const { data: event } = await sb
    .from("events")
    .select("solana_collection_address, status, date")
    .eq("id", ticket.event_id)
    .single<Pick<EventRow, "solana_collection_address" | "status" | "date">>();
  if (event?.status === "canceled") throw new Error("Event canceled");
  if (event && new Date(event.date).getTime() < Date.now()) throw new Error("Event already passed");

  // Ensure buyer wallet.
  const { address: buyerWallet } = await ensureCustodialWallet(params.buyerUserId);

  // Thaw → transfer → refreeze via marketplace authority.
  const result = await marketplaceTransfer({
    assetAddress: ticket.nft_asset_address,
    collectionAddress: event?.solana_collection_address ?? null,
    sellerUserId: listing.seller_user_id,
    buyerWallet,
  });
  const signature = result.transfer_signature;

  // Flip DB.
  await sb
    .from("tickets")
    .update({
      owner_user_id: params.buyerUserId,
      owner_wallet_address: buyerWallet,
      status: "sold",
      current_listing_id: null,
    })
    .eq("id", ticket.id);

  await sb
    .from("resale_listings")
    .update({
      status: "sold",
      buyer_user_id: params.buyerUserId,
      sold_at: new Date().toISOString(),
    })
    .eq("id", listing.id);

  await audit({
    actorUserId: params.buyerUserId,
    action: "resale.fulfill",
    entityType: "resale_listing",
    entityId: listing.id,
    metadata: { tx: signature, ticket: ticket.id },
  });
}
