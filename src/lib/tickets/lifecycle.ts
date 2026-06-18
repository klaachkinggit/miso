import crypto from "node:crypto";
import type { Address } from "viem";

import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/api/errors";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
  markChainOpMined,
  markChainOpRepairNeeded,
  openOrResumeChainOp,
  runChainOp,
  TransactionRevertError,
  TransactionTimeoutError,
} from "@/lib/chain/ops";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadJson } from "@/lib/thirdweb/storage";
import { backendWallet } from "@/lib/thirdweb/transactions";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import { notifyWaitlistHead } from "@/lib/waitlist";
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

export const RESERVATION_TTL_SECONDS = 30 * 60;
const RESERVATION_TTL_MS = RESERVATION_TTL_SECONDS * 1000;

function mockChainEnabled(): boolean {
  return process.env.MISO_MOCK_CHAIN === "1";
}

function mockAddress(seed: string): Address {
  return `0x${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40)}` as Address;
}

function mockTxHash(seed: string): string {
  return `0x${crypto.createHash("sha256").update(seed).digest("hex")}`;
}

class StaleReservationError extends Error {
  constructor(
    message = "Reservation is stale or no longer belongs to this buyer",
  ) {
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
    .select("*, events(status)")
    .eq("id", params.categoryId)
    .single<TicketCategory & { events: { status: string } }>();
  if (categoryError || !category) throw new Error("Category not found");
  if (category.events.status !== "published")
    throw new DomainError("Sales not open");
  if (!category.sales_enabled)
    throw new DomainError("Sales not open for this category");
  if (category.sold_count >= category.supply) throw new DomainError("Sold out");

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const { data: candidate, error: ticketError } = await sb
      .from("tickets")
      .select("*")
      .eq("category_id", params.categoryId)
      .or(
        `status.eq.available,and(status.eq.reserved,reserved_until.lt.${now})`,
      )
      .order("serial_number", { ascending: true })
      .limit(1)
      .maybeSingle<Ticket>();
    if (ticketError) throw ticketError;
    if (!candidate) throw new DomainError("No tickets available");

    const reservedUntil = new Date(
      Date.now() + RESERVATION_TTL_MS,
    ).toISOString();
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

// Releases a reservation to `available`. Refuses to touch tickets that
// are `minting`, `sold`, or `repair_needed`: those have either an
// in-flight chain op or a mined token attached. A genuine release frees
// inventory, so notify the waitlist head — but only when a row was
// actually flipped (a double-release matches zero rows → no double-notify).
export async function releaseReservation(ticketId: string): Promise<void> {
  const sb = createServiceClient();
  const { data: released } = await sb
    .from("tickets")
    .update({
      status: "available",
      reserved_until: null,
      owner_user_id: null,
    })
    .eq("id", ticketId)
    .eq("status", "reserved")
    .select("event_id")
    .maybeSingle<Pick<Ticket, "event_id">>();
  if (released)
    await notifyWaitlistHead({ eventId: released.event_id, source: "release" });
}

export interface FulfillReceipt {
  contractAddress: string;
  tokenId: number;
  mintTxHash: string;
  metadataUri: string;
  ownerEvmAddress: string;
}

// Mints an ERC-721 to the buyer's on-chain owner address, then flips the row to
// `sold`. The reservation is first claimed into a `minting` state and a
// `chain_ops` row is persisted BEFORE the chain call. On retry the
// existing chain_ops row is resumed (reusing the original transactionId)
// so a timeout-then-retry can never double-mint.
//
// Failure modes:
//   * Pre-broadcast error → ticket released back to `available`,
//     chain_op marked errored; settlement compensates the debit.
//   * Timeout              → ticket stays `minting`, chain_op stays
//     `sent`. Retry resumes the same tx. No compensation.
//   * Mined-then-DB-fail   → chain_op + ticket → `repair_needed`. Owner
//     and tokenId may already exist on chain; do NOT compensate. Admin
//     tool re-runs the DB update idempotently.
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

  // Read purchase to resolve gift recipient + extras + advance/min-spending
  // snapshot. The recipient becomes the on-chain holder and the row owner.
  const { data: purchase } = await sb
    .from("purchases")
    .select(
      "id, gift_recipient_user_id, extra_guests_count, online_advance_amount, min_spending_total",
    )
    .eq("id", params.purchaseId)
    .single<{
      id: string;
      gift_recipient_user_id: string | null;
      extra_guests_count: number;
      online_advance_amount: number | null;
      min_spending_total: number | null;
    }>();
  if (!purchase) throw new Error("Purchase missing");

  const recipientUserId = purchase.gift_recipient_user_id ?? params.buyerUserId;
  const extrasCount = purchase.extra_guests_count ?? 0;
  const advancePaid = Number(purchase.online_advance_amount ?? 0);
  const minSpendingTotal =
    purchase.min_spending_total != null
      ? Number(purchase.min_spending_total)
      : null;
  const minSpendingRemaining =
    minSpendingTotal != null
      ? Math.max(0, minSpendingTotal - advancePaid)
      : null;

  // Fast-path: a prior attempt already minted + flipped to sold for this
  // exact purchase. Treat as success — settlement can record paid.
  if (
    ticket.status === "sold" &&
    ticket.original_purchase_id === params.purchaseId
  ) {
    return {
      contractAddress: ticket.nft_contract_address ?? "",
      tokenId: ticket.nft_token_id ?? ticket.serial_number,
      mintTxHash: ticket.mint_tx_hash ?? "",
      metadataUri: ticket.metadata_uri ?? "",
      ownerEvmAddress: ticket.owner_evm_address ?? "",
    };
  }

  if (ticket.status === "repair_needed") {
    throw new Error(
      `Ticket ${ticket.id} is in repair_needed — admin must reconcile chain vs DB.`,
    );
  }

  // Allow resume from `minting` if the chain_op already exists for this
  // purchase; otherwise require a fresh `reserved` row.
  const isResumable =
    ticket.status === "minting" && ticket.owner_user_id === params.buyerUserId;
  const isReserved =
    ticket.status === "reserved" &&
    ticket.owner_user_id === params.buyerUserId &&
    !!ticket.reserved_until &&
    new Date(ticket.reserved_until).getTime() >= Date.now();
  if (!isResumable && !isReserved) {
    throw new StaleReservationError();
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) throw new Error("Event missing");
  // Re-check status right before the chain call — the event may have
  // been canceled between reservation and mint. cancelEventSetup flips
  // sold/listed/etc to refund_pending but cannot recall an in-flight
  // mint, so we refuse to broadcast at all.
  if (event.status === "canceled") {
    throw new DomainError("Event has been canceled — refusing to mint.");
  }
  if (!event.nft_contract_address && !mockChainEnabled()) {
    throw new Error("Event has no deployed contract");
  }
  const contractAddress = (event.nft_contract_address ??
    mockAddress(`event:${event.id}`)) as Address;

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", ticket.category_id)
    .single<TicketCategory>();
  if (!category) throw new Error("Category missing");

  const baseCapacity = category.base_capacity ?? 1;
  const totalHeadcount =
    category.kind === "club_table" ? baseCapacity + extrasCount : 1;
  const colorSnapshot = category.color_hex ?? null;

  if (mockChainEnabled()) {
    const recipientWallet = mockAddress(`wallet:${recipientUserId}`);
    const metadataUri = `ipfs://miso-e2e/${ticket.id}`;
    const mintTxHash = mockTxHash(`mint:${params.purchaseId}:${ticket.id}`);
    const tierImageUrl =
      category.image_url ?? event.ticket_visual_url ?? event.image_url;

    if (isReserved) {
      const { data: claimed } = await sb
        .from("tickets")
        .update({ status: "minting" })
        .eq("id", ticket.id)
        .eq("status", "reserved")
        .eq("owner_user_id", params.buyerUserId)
        .select("id")
        .maybeSingle();
      if (!claimed) throw new StaleReservationError();
    }

    const { data: updatedTicket, error: ticketUpdateError } = await sb
      .from("tickets")
      .update({
        status: "sold",
        owner_user_id: recipientUserId,
        owner_evm_address: recipientWallet,
        nft_contract_address: contractAddress,
        nft_token_id: ticket.serial_number,
        mint_tx_hash: mintTxHash,
        metadata_uri: metadataUri,
        image_url: tierImageUrl,
        reserved_until: null,
        minted_at: new Date().toISOString(),
        original_purchase_id: params.purchaseId,
        extra_guests_count: extrasCount,
        total_headcount: totalHeadcount,
        min_spending_total: minSpendingTotal,
        min_spending_remaining: minSpendingRemaining,
        color_hex_snapshot: colorSnapshot,
      })
      .eq("id", ticket.id)
      .in("status", ["minting", "sold"])
      .select("id")
      .maybeSingle();

    if (ticketUpdateError) throw ticketUpdateError;
    if (!updatedTicket) {
      throw new Error(
        `Ticket ${ticket.id} could not be flipped to sold after mock mint`,
      );
    }

    await sb
      .from("ticket_categories")
      .update({ sold_count: category.sold_count + 1 })
      .eq("id", category.id);

    await audit({
      actorUserId: params.buyerUserId,
      action: "ticket.mint.mock",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        contract: contractAddress,
        token_id: ticket.serial_number,
        tx_hash: mintTxHash,
        metadata_uri: metadataUri,
        owner: recipientWallet,
        recipient_user_id: recipientUserId,
        purchase: params.purchaseId,
        extra_guests: extrasCount,
        headcount: totalHeadcount,
      },
    });

    return {
      contractAddress,
      tokenId: ticket.serial_number,
      mintTxHash,
      metadataUri,
      ownerEvmAddress: recipientWallet,
    };
  }

  const recipientWallet = await buyerWalletAddress(recipientUserId);
  const recipientAddress = recipientWallet as Address;

  // Atomically claim reserved → minting if we're not already in minting.
  if (isReserved) {
    const { data: claimed } = await sb
      .from("tickets")
      .update({ status: "minting" })
      .eq("id", ticket.id)
      .eq("status", "reserved")
      .eq("owner_user_id", params.buyerUserId)
      .select("id")
      .maybeSingle();
    if (!claimed) throw new StaleReservationError();
  }

  // Prefer the category-specific artwork — falls back to the event
  // banner when the tier hasn't been given its own image.
  const tierImage =
    category.image_ipfs_uri ??
    category.image_url ??
    event.image_ipfs_uri ??
    event.ticket_visual_url ??
    event.image_url ??
    "";
  const clubAttributes =
    category.kind === "club_table"
      ? [
          { trait_type: "Color", value: colorSnapshot ?? "" },
          { trait_type: "Base Guests", value: baseCapacity },
          { trait_type: "Extra Guests", value: extrasCount },
          { trait_type: "Total Headcount", value: totalHeadcount },
          { trait_type: "Online Advance Paid", value: advancePaid },
          {
            trait_type: "Min Spending Remaining",
            value: minSpendingRemaining ?? 0,
          },
        ]
      : [];
  const metadata = {
    name: `${event.name} — ${category.kind === "club_table" ? "Table" : "Ticket"} #${ticket.serial_number}`,
    description: event.description ?? "",
    image: tierImage,
    attributes: [
      { trait_type: "Event", value: event.name },
      { trait_type: "Category", value: category.name },
      { trait_type: "Tier", value: category.kind },
      { trait_type: "Serial", value: ticket.serial_number },
      { trait_type: "Redeemed", value: "false" },
      ...clubAttributes,
    ],
  };
  // Only upload metadata for a fresh op (resumed ops already have one).
  const metadataUri =
    ticket.metadata_uri && isResumable
      ? ticket.metadata_uri
      : await uploadJson(metadata);

  const tokenId = BigInt(ticket.serial_number);
  const roleAdmin = (event.role_admin_address ??
    (await backendWallet())) as Address;

  const { op, resumed } = await openOrResumeChainOp({
    opType: "mint",
    purchaseId: params.purchaseId,
    ticketId: ticket.id,
    contractAddress,
    tokenId: ticket.serial_number,
    toAddress: recipientWallet,
    metadataUri,
  });

  let mintTxHash: string;
  try {
    const { txHash } = await runChainOp({
      op,
      resumed,
      from: roleAdmin,
      call: {
        contractAddress,
        method: "function mintTo(address to, uint256 tokenId, string uri)",
        params: [recipientAddress, tokenId, op.metadata_uri ?? metadataUri],
      },
    });
    mintTxHash = txHash;
  } catch (err) {
    // ONLY an explicit TransactionRevertError is safe to treat as a
    // pre-mined terminal failure. Anything else can leave a broadcasted
    // tx that mines later, so keep the ticket in `minting` and let
    // settlement quarantine the purchase.
    if (err instanceof TransactionRevertError) {
      await sb
        .from("tickets")
        .update({
          status: "available",
          owner_user_id: null,
          reserved_until: null,
        })
        .eq("id", ticket.id)
        .eq("status", "minting");
      throw new Error(
        `Mint reverted for ticket ${ticket.id}: ${err.record.errorMessage ?? "unknown"}`,
      );
    }
    if (err instanceof TransactionTimeoutError) throw err;
    throw new ChainOpInFlightError(
      op.id,
      op.transaction_id,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // Tx mined. From this point, NO compensation: the token exists on chain.
  // A DB-update failure → repair_needed for an admin to reconcile.
  try {
    const { data: updatedTicket, error: ticketUpdateError } = await sb
      .from("tickets")
      .update({
        status: "sold",
        owner_user_id: recipientUserId,
        owner_evm_address: recipientWallet,
        nft_contract_address: contractAddress,
        nft_token_id: ticket.serial_number,
        mint_tx_hash: mintTxHash,
        metadata_uri: op.metadata_uri ?? metadataUri,
        image_url: category.image_url ?? event.image_url,
        reserved_until: null,
        minted_at: new Date().toISOString(),
        original_purchase_id: params.purchaseId,
        extra_guests_count: extrasCount,
        total_headcount: totalHeadcount,
        min_spending_total: minSpendingTotal,
        min_spending_remaining: minSpendingRemaining,
        color_hex_snapshot: colorSnapshot,
      })
      .eq("id", ticket.id)
      .in("status", ["minting", "sold"])
      .select("id")
      .maybeSingle();

    if (ticketUpdateError) throw ticketUpdateError;
    if (!updatedTicket) {
      throw new Error(
        `Ticket ${ticket.id} could not be flipped to sold after mint`,
      );
    }

    await sb
      .from("ticket_categories")
      .update({ sold_count: category.sold_count + 1 })
      .eq("id", category.id);

    await markChainOpMined(op.id, mintTxHash);

    await audit({
      actorUserId: params.buyerUserId,
      action: "ticket.mint",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        contract: contractAddress,
        token_id: ticket.serial_number,
        tx_hash: mintTxHash,
        metadata_uri: op.metadata_uri ?? metadataUri,
        owner: recipientWallet,
        recipient_user_id: recipientUserId,
        purchase: params.purchaseId,
        chain_op: op.id,
        extra_guests: extrasCount,
        headcount: totalHeadcount,
      },
    });

    return {
      contractAddress,
      tokenId: ticket.serial_number,
      mintTxHash,
      metadataUri: op.metadata_uri ?? metadataUri,
      ownerEvmAddress: recipientWallet,
    };
  } catch (dbErr) {
    const message = dbErr instanceof Error ? dbErr.message : "db update failed";
    await sb
      .from("tickets")
      .update({ status: "repair_needed" })
      .eq("id", ticket.id)
      .eq("status", "minting");
    await markChainOpRepairNeeded(op.id, message);
    await audit({
      actorUserId: params.buyerUserId,
      action: "ticket.mint_repair_needed",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        contract: contractAddress,
        token_id: ticket.serial_number,
        tx_hash: mintTxHash,
        chain_op: op.id,
        error: message,
      },
    });
    // Token is on chain. Throw a typed repair error so settlement
    // does not compensate the debit.
    throw new ChainOpRepairError(op.id, mintTxHash, message);
  }
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

// Refunds the ticket from a terminal-safe state only. Blocks `minting`
// and `transferring`: those have an in-flight chain op whose outcome
// is unknown — refunding now races the mined tx. `repair_needed` is
// allowed (admin already chose to refund after reconciliation).
export async function markTicketRefunded(ticketId: string): Promise<void> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tickets")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", ticketId)
    .in("status", [
      "sold",
      "listed",
      "refund_pending",
      "repair_needed",
      "canceled",
      "available",
      "reserved",
      "expired",
    ])
    .select("id, category_id, event_id")
    .maybeSingle<Pick<Ticket, "id" | "category_id" | "event_id">>();
  if (error) throw error;
  if (!data)
    throw new DomainError("Cannot refund this ticket in its current state");

  // A refund must genuinely return PURCHASABLE inventory, or the waitlist
  // notification is hollow. The buy path needs BOTH: the availability gate
  // (sold_count < supply) AND an `available` ticket row to reserve. The
  // refunded row keeps its minted NFT (serial == tokenId is live on chain),
  // so it cannot be re-offered — re-fulfilling it would re-mint the same
  // tokenId. Instead decrement sold_count and seed one fresh `available` row
  // with the next serial, mirroring createTicketCategory.
  const { data: category } = await sb
    .from("ticket_categories")
    .select("sold_count")
    .eq("id", data.category_id)
    .maybeSingle<Pick<TicketCategory, "sold_count">>();
  if (category && category.sold_count > 0) {
    await sb
      .from("ticket_categories")
      .update({ sold_count: category.sold_count - 1 })
      .eq("id", data.category_id);

    const { data: lastTicket } = await sb
      .from("tickets")
      .select("serial_number")
      .eq("event_id", data.event_id)
      .order("serial_number", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Ticket, "serial_number">>();
    await sb.from("tickets").insert({
      event_id: data.event_id,
      category_id: data.category_id,
      serial_number: (lastTicket?.serial_number ?? 0) + 1,
      status: "available",
    });
  }
}

// Cancels rows that have NOT touched chain yet. Tickets in `minting`,
// `transferring`, or `repair_needed` have a mined or in-flight NFT
// behind them and must be reconciled by an admin tool — not silently
// flipped to `canceled`. Those are picked up by
// markSoldTicketsRefundPending instead so the buyer gets refunded.
export async function cancelUnsoldTickets(params: {
  eventId: string;
  categoryId?: string | null;
}): Promise<void> {
  const sb = createServiceClient();
  let query = sb
    .from("tickets")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      reserved_until: null,
    })
    .eq("event_id", params.eventId)
    .in("status", ["available", "reserved"]);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  const { error } = await query;
  if (error) throw error;
}

// Sweeps every state that has (or may have) an on-chain NFT for the
// event into `refund_pending`. Includes the in-flight states because
// their chain side is committed (or may commit imminently) and the
// holder is owed a refund. The admin reconcile tool resolves the
// chain/DB delta before final refund.
export async function markSoldTicketsRefundPending(
  eventId: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("tickets")
    .update({ status: "refund_pending" })
    .eq("event_id", eventId)
    .in("status", [
      "sold",
      "listed",
      "minting",
      "transferring",
      "repair_needed",
    ]);
  if (error) throw error;
}
