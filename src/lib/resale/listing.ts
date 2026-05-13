// Internal resale marketplace.
// Custodial-only in MVP. External-wallet sellers see "transfer to platform first" notice.
// TODO V2: trustless on-chain marketplace.

import { createServiceClient } from "@/lib/supabase/service";
import {
  compensateResaleBuyerDebit,
  creditResaleSellerBalance,
  debitResaleBuyerBalance,
} from "@/lib/balances/ledger";
import { demoMarketplaceTransfer } from "@/lib/demo/artifacts";
import { ensureCustodialWallet } from "@/lib/solana/wallet";
import { audit } from "@/lib/audit";
import {
  markTicketListed,
  markTicketResaleCanceled,
  transferListedTicketToBuyer,
} from "@/lib/tickets/lifecycle";
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

  try {
    await markTicketListed({ ticketId: ticket.id, listingId: listing.id });
  } catch (error) {
    await sb.from("resale_listings").update({ status: "canceled" }).eq("id", listing.id);
    throw error;
  }

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

  await markTicketResaleCanceled({ ticketId: listing.ticket_id, listingId: listing.id });

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
  if (listing.status === "sold" && listing.buyer_user_id === params.buyerUserId) return;
  if (listing.status !== "active") throw new Error("Listing not active");
  if (listing.seller_user_id === params.buyerUserId) throw new Error("Cannot buy your own listing");

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", listing.ticket_id)
    .single<Ticket>();
  if (!ticket?.nft_asset_address) throw new Error("Ticket NFT missing");
  if (INVALID_FOR_RESALE.has(ticket.status)) {
    throw new Error(`Ticket cannot be transferred (status: ${ticket.status})`);
  }
  if (ticket.status !== "listed") {
    if (ticket.owner_user_id === params.buyerUserId && listing.status === "active") {
      if (Number(listing.price) > 0) {
        await creditResaleSellerBalance({
          listingId: listing.id,
          sellerUserId: listing.seller_user_id,
          amount: listing.price,
          currency: listing.currency,
        });
      }
      await sb
        .from("resale_listings")
        .update({
          status: "sold",
          buyer_user_id: params.buyerUserId,
          sold_at: new Date().toISOString(),
        })
        .eq("id", listing.id);
      return;
    }
    throw new Error(`Ticket not listed (status: ${ticket.status})`);
  }

  const { data: event } = await sb
    .from("events")
    .select("status, date")
    .eq("id", ticket.event_id)
    .single<Pick<EventRow, "status" | "date">>();
  if (event?.status === "canceled") throw new Error("Event canceled");
  if (event && new Date(event.date).getTime() < Date.now()) throw new Error("Event already passed");

  // Ensure buyer wallet.
  const { address: buyerWallet } = await ensureCustodialWallet(params.buyerUserId);
  const listingAmount = Number(listing.price);

  if (listingAmount > 0) {
    await debitResaleBuyerBalance({
      listingId: listing.id,
      buyerUserId: params.buyerUserId,
      amount: listing.price,
      currency: listing.currency,
    });
  }

  // Demo: synthetic thaw/transfer/refreeze signatures only.
  const result = await demoMarketplaceTransfer();
  const signature = result.transfer_signature;

  try {
    await transferListedTicketToBuyer({
      ticketId: ticket.id,
      listingId: listing.id,
      buyerUserId: params.buyerUserId,
      buyerWalletAddress: buyerWallet,
    });
  } catch (error) {
    if (listingAmount > 0) {
      await compensateResaleBuyerDebit({
        listingId: listing.id,
        buyerUserId: params.buyerUserId,
        amount: listing.price,
        currency: listing.currency,
      });
    }
    throw error;
  }

  if (listingAmount > 0) {
    await creditResaleSellerBalance({
      listingId: listing.id,
      sellerUserId: listing.seller_user_id,
      amount: listing.price,
      currency: listing.currency,
    });
  }

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
