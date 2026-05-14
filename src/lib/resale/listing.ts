// Internal resale marketplace.
//
// Sellers list a sold ticket → buyer settles in MAD via Account Balance →
// backend wallet broadcasts `adminTransfer(seller, buyer, tokenId)` on the
// event's MisoTicket contract. Users never sign on chain; transfer is
// authorized by the listing creation itself.

import type { Address } from "viem";

import { createServiceClient } from "@/lib/supabase/service";
import {
  compensateResaleBuyerDebit,
  creditResaleSellerBalance,
  debitResaleBuyerBalance,
} from "@/lib/balances/ledger";
import { encodeAdminTransfer } from "@/lib/thirdweb/contracts/misoTicket";
import {
  TransactionRevertError,
  TransactionTimeoutError,
  waitForTransaction,
  writeContract,
} from "@/lib/thirdweb/transactions";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import { audit } from "@/lib/audit";
import {
  markTicketListed,
  markTicketResaleCanceled,
  transferListedTicketToBuyer,
} from "@/lib/tickets/lifecycle";
import type { Ticket, EventRow, TicketCategory, ResaleListing } from "@/types/db";

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
  if (category.max_resale_price !== null && params.price > category.max_resale_price) {
    throw new Error(`Resale price exceeds max ${category.max_resale_price}`);
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
  if (!ticket) throw new Error("Ticket missing");
  if (!ticket.nft_contract_address || ticket.nft_token_id === null) {
    throw new Error("Ticket has no on-chain identity");
  }
  if (!ticket.owner_evm_address) throw new Error("Seller smart account missing on ticket");
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

  const { data: buyerProfile } = await sb
    .from("profiles")
    .select("email")
    .eq("id", params.buyerUserId)
    .single<{ email: string }>();
  if (!buyerProfile?.email) throw new Error("Buyer profile missing email");
  const { smartAccountAddress: buyerSmartAccount } = await ensureUserWallet(
    params.buyerUserId,
    buyerProfile.email,
  );

  const sellerSmartAccount = ticket.owner_evm_address;
  const listingAmount = Number(listing.price);

  if (listingAmount > 0) {
    await debitResaleBuyerBalance({
      listingId: listing.id,
      buyerUserId: params.buyerUserId,
      amount: listing.price,
      currency: listing.currency,
    });
  }

  let transferTxHash: string | null = null;
  try {
    const data = encodeAdminTransfer({
      from: sellerSmartAccount as Address,
      to: buyerSmartAccount as Address,
      tokenId: BigInt(ticket.nft_token_id),
    });
    const queued = await writeContract({
      contractAddress: ticket.nft_contract_address as Address,
      data,
    });
    const record = await waitForTransaction(queued.transactionId, {
      timeoutMs: 180_000,
    });
    transferTxHash = record.transactionHash ?? null;
  } catch (err) {
    if (listingAmount > 0) {
      await compensateResaleBuyerDebit({
        listingId: listing.id,
        buyerUserId: params.buyerUserId,
        amount: listing.price,
        currency: listing.currency,
      });
    }
    const message =
      err instanceof TransactionRevertError
        ? `adminTransfer reverted: ${err.record.errorMessage ?? "unknown"}`
        : err instanceof TransactionTimeoutError
          ? `adminTransfer timed out (transactionId=${err.transactionId})`
          : err instanceof Error
            ? err.message
            : "adminTransfer failed";
    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.transfer_failed",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        contract: ticket.nft_contract_address,
        token_id: ticket.nft_token_id,
        from: sellerSmartAccount,
        to: buyerSmartAccount,
        error: message,
      },
    });
    throw new Error(message);
  }

  try {
    await transferListedTicketToBuyer({
      ticketId: ticket.id,
      listingId: listing.id,
      buyerUserId: params.buyerUserId,
      buyerEvmAddress: buyerSmartAccount,
      lastTransferTxHash: transferTxHash,
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
    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.db_update_failed",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        tx_hash: transferTxHash,
        error: error instanceof Error ? error.message : "db update failed",
      },
    });
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
    metadata: {
      ticket_id: ticket.id,
      contract: ticket.nft_contract_address,
      token_id: ticket.nft_token_id,
      tx_hash: transferTxHash,
    },
  });
}
