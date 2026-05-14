import type { Address } from "viem";

import { audit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { encodeMintTo } from "@/lib/thirdweb/contracts/misoTicket";
import { uploadJson } from "@/lib/thirdweb/storage";
import {
  TransactionRevertError,
  TransactionTimeoutError,
  waitForTransaction,
  writeContract,
} from "@/lib/thirdweb/transactions";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import type { EventRow, Ticket, TicketCategory } from "@/types/db";

async function buyerWalletAddress(userId: string): Promise<string> {
  const sb = createServiceClient();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single<{ email: string }>();
  if (error || !profile?.email) throw new Error("Buyer profile missing email");
  const { smartAccountAddress } = await ensureUserWallet(userId, profile.email);
  return smartAccountAddress;
}

const RESERVATION_TTL_MS = 10 * 60 * 1000;

export class StaleReservationError extends Error {
  constructor(message = "Reservation is stale or no longer belongs to this buyer") {
    super(message);
    this.name = "StaleReservationError";
  }
}

export async function reserveTicket(params: {
  categoryId: string;
  buyerUserId: string;
}): Promise<{ ticket: Ticket; category: TicketCategory }> {
  const sb = createServiceClient();

  const { data: category, error: categoryError } = await sb
    .from("ticket_categories")
    .select("*, events(sales_enabled, status)")
    .eq("id", params.categoryId)
    .single<TicketCategory & { events: { sales_enabled: boolean; status: string } }>();
  if (categoryError || !category) throw new Error("Category not found");
  if (!category.events.sales_enabled || category.events.status !== "published") {
    throw new Error("Sales not open");
  }
  if (category.sold_count >= category.supply) throw new Error("Sold out");

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const { data: candidate, error: ticketError } = await sb
      .from("tickets")
      .select("*")
      .eq("category_id", params.categoryId)
      .or(`status.eq.available,and(status.eq.reserved,reserved_until.lt.${now})`)
      .order("serial_number", { ascending: true })
      .limit(1)
      .maybeSingle<Ticket>();
    if (ticketError) throw ticketError;
    if (!candidate) throw new Error("No tickets available");

    const reservedUntil = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
    let query = sb
      .from("tickets")
      .update({
        status: "reserved",
        reserved_until: reservedUntil,
        owner_user_id: params.buyerUserId,
      })
      .eq("id", candidate.id);

    query =
      candidate.status === "available"
        ? query.eq("status", "available")
        : query.eq("status", "reserved").lt("reserved_until", now);

    const { data: reserved, error: updateError } = await query
      .select("*")
      .maybeSingle<Ticket>();
    if (updateError) throw updateError;
    if (reserved) return { ticket: reserved, category };
  }

  throw new Error("Ticket no longer available, retry");
}

export async function releaseReservation(ticketId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("tickets")
    .update({
      status: "available",
      reserved_until: null,
      owner_user_id: null,
    })
    .eq("id", ticketId)
    .eq("status", "reserved");
}

export interface FulfillReceipt {
  contractAddress: string;
  tokenId: number;
  mintTxHash: string;
  metadataUri: string;
  ownerEvmAddress: string;
}

// Mints an ERC-721 to the buyer's smart account, then flips the reservation
// row to `sold`. Failure at any step throws — settlement compensates the
// debit. The DB update is conditional on the row still being the same
// reservation, so a stale retry can't double-mint silently (a second mint
// would conflict on the unique (contract, tokenId) index).
export async function fulfillReservedTicket(params: {
  ticketId: string;
  buyerUserId: string;
  purchaseId: string;
}): Promise<FulfillReceipt> {
  const sb = createServiceClient();

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", params.ticketId)
    .single<Ticket>();
  if (!ticket) throw new Error("Ticket missing");
  if (
    ticket.status !== "reserved" ||
    ticket.owner_user_id !== params.buyerUserId ||
    !ticket.reserved_until ||
    new Date(ticket.reserved_until).getTime() < Date.now()
  ) {
    throw new StaleReservationError();
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) throw new Error("Event missing");
  if (!event.nft_contract_address) {
    throw new Error("Event has no deployed contract");
  }
  const contractAddress = event.nft_contract_address as Address;

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", ticket.category_id)
    .single<TicketCategory>();
  if (!category) throw new Error("Category missing");

  const buyerWallet = await buyerWalletAddress(params.buyerUserId);
  const buyerAddress = buyerWallet as Address;

  const metadata = {
    name: `${event.name} — Ticket #${ticket.serial_number}`,
    description: event.description ?? "",
    image: event.image_ipfs_uri ?? event.image_url ?? "",
    attributes: [
      { trait_type: "Event", value: event.name },
      { trait_type: "Category", value: category.name },
      { trait_type: "Serial", value: ticket.serial_number },
      { trait_type: "Redeemed", value: "false" },
    ],
  };
  const metadataUri = await uploadJson(metadata);

  const tokenId = BigInt(ticket.serial_number);
  const data = encodeMintTo({ to: buyerAddress, tokenId, uri: metadataUri });

  let mintTxHash: string;
  try {
    const queued = await writeContract({ contractAddress, data });
    const record = await waitForTransaction(queued.transactionId, {
      timeoutMs: 180_000,
    });
    mintTxHash = record.transactionHash ?? "";
  } catch (err) {
    if (err instanceof TransactionRevertError) {
      throw new Error(
        `Mint reverted for ticket ${ticket.id}: ${err.record.errorMessage ?? "unknown"}`,
      );
    }
    if (err instanceof TransactionTimeoutError) {
      throw new Error(
        `Mint timed out for ticket ${ticket.id} (transactionId=${err.transactionId})`,
      );
    }
    throw err;
  }

  const { data: updatedTicket, error: ticketUpdateError } = await sb
    .from("tickets")
    .update({
      status: "sold",
      owner_user_id: params.buyerUserId,
      owner_evm_address: buyerWallet,
      nft_contract_address: contractAddress,
      nft_token_id: ticket.serial_number,
      mint_tx_hash: mintTxHash,
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

  await audit({
    actorUserId: params.buyerUserId,
    action: "ticket.mint",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: {
      contract: contractAddress,
      token_id: ticket.serial_number,
      tx_hash: mintTxHash,
      metadata_uri: metadataUri,
      owner: buyerWallet,
      purchase: params.purchaseId,
    },
  });

  return {
    contractAddress,
    tokenId: ticket.serial_number,
    mintTxHash,
    metadataUri,
    ownerEvmAddress: buyerWallet,
  };
}

export async function markTicketListed(params: {
  ticketId: string;
  listingId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tickets")
    .update({ status: "listed", current_listing_id: params.listingId })
    .eq("id", params.ticketId)
    .eq("status", "sold")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Ticket not listable");
}

export async function markTicketResaleCanceled(params: {
  ticketId: string;
  listingId: string;
}): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("tickets")
    .update({ status: "sold", current_listing_id: null })
    .eq("id", params.ticketId)
    .eq("status", "listed")
    .eq("current_listing_id", params.listingId);
}

export async function transferListedTicketToBuyer(params: {
  ticketId: string;
  listingId: string;
  buyerUserId: string;
  buyerEvmAddress: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tickets")
    .update({
      owner_user_id: params.buyerUserId,
      owner_evm_address: params.buyerEvmAddress,
      status: "sold",
      current_listing_id: null,
    })
    .eq("id", params.ticketId)
    .eq("status", "listed")
    .eq("current_listing_id", params.listingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Ticket is no longer listed");
}

export async function markTicketRedeemed(params: {
  ticketId: string;
  redeemTxHash?: string | null;
}): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("tickets")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      redeem_tx_hash: params.redeemTxHash ?? null,
    })
    .eq("id", params.ticketId)
    .eq("status", "sold")
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function markTicketRefunded(ticketId: string): Promise<void> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tickets")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", ticketId)
    .not("status", "eq", "used")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cannot refund a used ticket");
}

export async function cancelUnsoldTickets(params: {
  eventId: string;
  categoryId?: string | null;
}): Promise<void> {
  const sb = createServiceClient();
  let query = sb
    .from("tickets")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), reserved_until: null })
    .eq("event_id", params.eventId)
    .in("status", ["available", "reserved"]);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  const { error } = await query;
  if (error) throw error;
}

export async function markSoldTicketsRefundPending(eventId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("tickets")
    .update({ status: "refund_pending" })
    .eq("event_id", eventId)
    .in("status", ["sold", "listed"]);
  if (error) throw error;
}
