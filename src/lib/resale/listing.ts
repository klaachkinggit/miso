// Internal resale marketplace.
//
// Sellers list a sold ticket → buyer pays via Stripe Checkout →
// backend wallet broadcasts `adminTransfer(seller, buyer, tokenId)` on the
// event's MisoTicket contract. Users never sign on chain; transfer is
// authorized by the listing creation itself.

import type { Address } from "viem";

import { createServiceClient } from "@/lib/supabase/service";
import { DomainError } from "@/lib/api/errors";
import {
  createResaleStripeCheckoutSession,
  expireStripeCheckoutSession,
  stripe,
} from "@/lib/payments/stripe";
import {
  ChainOpRepairError,
  markChainOpMined,
  markChainOpRepairNeeded,
  openOrResumeChainOp,
  runChainOp,
  TransactionRevertError,
  TransactionTimeoutError,
} from "@/lib/chain/ops";
import { backendWallet } from "@/lib/thirdweb/transactions";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import { audit } from "@/lib/audit";
import { resalePlatformFee } from "@/lib/resale/pricing";
import {
  markTicketListed,
  markTicketResaleCanceled,
} from "@/lib/tickets/lifecycle";
import type { Ticket, EventRow, TicketCategory, ResaleListing, SalesChannel } from "@/types/db";

const INVALID_FOR_RESALE = new Set([
  "used",
  "refunded",
  "refund_pending",
  "canceled",
  "expired",
  "minting",
  "transferring",
  "repair_needed",
]);

export async function createResaleListing(params: {
  ticketId: string;
  sellerUserId: string;
  price: number;
}): Promise<ResaleListing> {
  const sb = createServiceClient();

  const { data: ticket } = await sb.from("tickets").select("*").eq("id", params.ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.owner_user_id !== params.sellerUserId) throw new DomainError("Not ticket owner");
  if (INVALID_FOR_RESALE.has(ticket.status)) {
    throw new DomainError(`Ticket cannot be listed (status: ${ticket.status})`);
  }
  if (ticket.status !== "sold") throw new Error(`Ticket not listable (status: ${ticket.status})`);

  const { data: event } = await sb.from("events").select("*").eq("id", ticket.event_id).single<EventRow>();
  if (!event) throw new Error("Event not found");
  if (event.status === "canceled") throw new DomainError("Event canceled");
  if (new Date(event.date).getTime() < Date.now()) throw new DomainError("Event already passed");

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", ticket.category_id)
    .single<TicketCategory>();
  if (!category?.resale_enabled) throw new DomainError("Resale not enabled for this category");

  // Anti-scalping cap: resale price must NOT exceed the original online
  // total paid by the first buyer (advance + paid extras for club tables,
  // or the standard ticket price). Seller breaks perfectly even; any
  // platform fee is added on top at checkout, paid by the secondary buyer.
  const originalPurchaseId = ticket.original_purchase_id;
  let originalOnlineTotal: number;
  if (originalPurchaseId) {
    const { data: origPurchase } = await sb
      .from("purchases")
      .select("amount")
      .eq("id", originalPurchaseId)
      .maybeSingle<{ amount: number }>();
    originalOnlineTotal = origPurchase ? Number(origPurchase.amount) : Number(category.price);
  } else {
    originalOnlineTotal = Number(category.price);
  }
  if (params.price > originalOnlineTotal) {
    throw new DomainError(
      `Resale price cannot exceed the original online total of ${originalOnlineTotal}.`,
    );
  }
  if (params.price < 0) throw new Error("Resale price must be positive");
  if (category.max_resale_price !== null && params.price > category.max_resale_price) {
    throw new DomainError(`Resale price exceeds max ${category.max_resale_price}`);
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
  if (!listing) throw new DomainError("Listing not found");
  if (listing.seller_user_id !== params.sellerUserId) throw new DomainError("Not listing owner");
  if (listing.status !== "active") throw new Error(`Listing not cancelable (status: ${listing.status})`);

  // Atomic transition active → canceled. If a concurrent buyer just
  // claimed the listing (active → transferring) the UPDATE returns
  // zero rows; refuse to flip the ticket back to `sold` in that case
  // or we'd race against fulfillResale.
  const { data: canceled } = await sb
    .from("resale_listings")
    .update({ status: "canceled" })
    .eq("id", listing.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!canceled) {
    throw new DomainError(
      "Listing is no longer cancelable — another buyer has claimed it.",
    );
  }

  await markTicketResaleCanceled({ ticketId: listing.ticket_id, listingId: listing.id });

  await audit({
    actorUserId: params.sellerUserId,
    action: "listing.cancel",
    entityType: "resale_listing",
    entityId: listing.id,
    metadata: { ticket_id: listing.ticket_id },
  });
}

// Thrown when an adminTransfer timed out without a terminal answer.
// Caller (HTTP route) must NOT compensate or release: chain may still
// mine. Admin retry tool resumes the same transactionId.
export class ResaleTransferPendingError extends Error {
  constructor(readonly listingId: string, readonly transactionId?: string) {
    super(`Resale transfer for listing ${listingId} is pending on chain.`);
    this.name = "ResaleTransferPendingError";
  }
}

export class ResaleCheckoutPreflightError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ResaleCheckoutPreflightError";
  }
}

async function getResaleCheckoutListing(params: {
  listingId: string;
  buyerUserId: string;
}): Promise<ResaleListing> {
  const sb = createServiceClient();

  const { data: listing } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", params.listingId)
    .maybeSingle<ResaleListing>();
  if (!listing) throw new ResaleCheckoutPreflightError("Listing not found.", 404);
  if (listing.status !== "active") {
    throw new ResaleCheckoutPreflightError("Listing is not active.");
  }
  if (listing.seller_user_id === params.buyerUserId) {
    throw new ResaleCheckoutPreflightError("Cannot buy your own listing.");
  }

  const { data: ticket } = await sb
    .from("tickets")
    .select("status")
    .eq("id", listing.ticket_id)
    .maybeSingle<Pick<Ticket, "status">>();
  if (!ticket) throw new ResaleCheckoutPreflightError("Ticket missing.");
  if (ticket.status !== "listed") {
    throw new ResaleCheckoutPreflightError(`Ticket is ${ticket.status}.`);
  }

  return listing;
}

export async function checkoutResaleListing(params: {
  listingId: string;
  buyerUserId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
  salesChannel?: SalesChannel;
  trackingOrigin?: string | null;
}): Promise<{ listing: ResaleListing; checkoutUrl: string }> {
  const sb = createServiceClient();
  if (params.idempotencyKey) {
    const { data: prior } = await sb
      .from("resale_listings")
      .select("*")
      .eq("buyer_user_id", params.buyerUserId)
      .eq("checkout_idempotency_key", params.idempotencyKey)
      .maybeSingle<ResaleListing>();
    if (prior?.provider_session_id) {
      const session = await stripe.checkout.sessions.retrieve(prior.provider_session_id);
      return {
        listing: prior,
        checkoutUrl: session.url ?? params.cancelUrl,
      };
    }
    if (prior) {
      throw new ResaleCheckoutPreflightError("Checkout is still being prepared.", 409);
    }
  }

  const listing = await getResaleCheckoutListing(params);
  const sellerAmount = Number(listing.price);
  const platformFeeAmount = resalePlatformFee(sellerAmount);
  const buyerTotalAmount = sellerAmount + platformFeeAmount;

  // Atomically claim listing before creating Stripe session so no concurrent
  // buyer can claim the same listing during payment.
  const { data: claimed } = await sb
    .from("resale_listings")
    .update({
      status: "transferring",
      buyer_user_id: params.buyerUserId,
      checkout_idempotency_key: params.idempotencyKey ?? null,
      sales_channel: params.salesChannel ?? "marketplace",
      tracking_origin: params.trackingOrigin ?? null,
    })
    .eq("id", listing.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    throw new ResaleCheckoutPreflightError("Listing was claimed by another buyer.");
  }

  const { data: ticket } = await sb
    .from("tickets")
    .select("event_id, category_id")
    .eq("id", listing.ticket_id)
    .single<{ event_id: string; category_id: string }>();

  const [{ data: event }, { data: category }] = await Promise.all([
    sb.from("events").select("name").eq("id", ticket?.event_id ?? "").maybeSingle<{ name: string }>(),
    sb.from("ticket_categories").select("name").eq("id", ticket?.category_id ?? "").maybeSingle<{ name: string }>(),
  ]);

  let session: import("stripe").Stripe.Checkout.Session;
  try {
    session = await createResaleStripeCheckoutSession({
      listingId: listing.id,
      buyerUserId: params.buyerUserId,
      amount: sellerAmount,
      platformFeeAmount,
      currency: listing.currency,
      eventName: event?.name ?? "Event",
      categoryName: category?.name ?? "Ticket",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      idempotencyKey: params.idempotencyKey,
    });
    if (!session.url) {
      await expireStripeCheckoutSession(session.id);
      throw new Error("Stripe Checkout session did not include a URL.");
    }
  } catch (err) {
    // Release claim if Stripe session creation fails.
    await sb
      .from("resale_listings")
      .update({
        status: "active",
        buyer_user_id: null,
        checkout_idempotency_key: null,
      })
      .eq("id", listing.id)
      .eq("status", "transferring");
    throw err;
  }

  const { error: providerUpdateError } = await sb
    .from("resale_listings")
    .update({
      provider_session_id: session.id,
      payment_provider: "stripe",
      platform_fee_amount: platformFeeAmount,
      buyer_total_amount: buyerTotalAmount,
      checkout_idempotency_key: params.idempotencyKey ?? null,
      sales_channel: params.salesChannel ?? "marketplace",
      tracking_origin: params.trackingOrigin ?? null,
    })
    .eq("id", listing.id);
  if (providerUpdateError) {
    await sb
      .from("resale_listings")
      .update({
        status: "active",
        buyer_user_id: null,
        checkout_idempotency_key: null,
      })
      .eq("id", listing.id)
      .eq("status", "transferring");
    await expireStripeCheckoutSession(session.id);
    throw providerUpdateError;
  }

  return { listing, checkoutUrl: session.url };
}

export async function fulfillResale(params: {
  listingId: string;
  buyerUserId: string;
}) {
  const sb = createServiceClient();

  // Load listing + ticket but treat them as advisory: the atomic claim
  // below is what actually wins the race.
  const { data: listingPeek } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", params.listingId)
    .single<ResaleListing>();
  if (!listingPeek) throw new DomainError("Listing not found");

  // Already-sold short-circuit (idempotent re-entry).
  if (listingPeek.status === "sold" && listingPeek.buyer_user_id === params.buyerUserId) {
    return;
  }
  if (listingPeek.seller_user_id === params.buyerUserId) {
    throw new DomainError("Cannot buy your own listing");
  }

  // ---- Atomic listing claim (active → transferring | resumable) -----------
  // Only one writer wins. Two parallel buyers cannot both pass this point.
  const isResumable =
    listingPeek.status === "transferring" &&
    listingPeek.buyer_user_id === params.buyerUserId;
  if (!isResumable && listingPeek.status !== "active") {
    throw new DomainError(`Listing not active (status: ${listingPeek.status})`);
  }
  if (!isResumable) {
    const { data: claimed } = await sb
      .from("resale_listings")
      .update({ status: "transferring", buyer_user_id: params.buyerUserId })
      .eq("id", listingPeek.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!claimed) {
      // Someone else claimed it. Re-read to give a clean error.
      const { data: fresh } = await sb
        .from("resale_listings")
        .select("status, buyer_user_id")
        .eq("id", listingPeek.id)
        .single<{ status: string; buyer_user_id: string | null }>();
      if (fresh?.status === "sold" && fresh.buyer_user_id === params.buyerUserId) return;
      throw new DomainError("Listing not active");
    }
  }

  // Re-read listing post-claim.
  const { data: listing } = await sb
    .from("resale_listings")
    .select("*")
    .eq("id", listingPeek.id)
    .single<ResaleListing>();
  if (!listing) throw new Error("Listing disappeared after claim");

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

  // Resume-after-finalize-fail: a prior attempt's chain tx mined and
  // the ticket was already flipped to sold under this buyer, but the
  // seller credit / listing finalize threw. Skip the chain path; jump
  // straight to finalize so the listing closes cleanly.
  if (
    isResumable &&
    ticket.status === "sold" &&
    ticket.owner_user_id === params.buyerUserId
  ) {
    await sb
      .from("resale_listings")
      .update({
        status: "sold",
        buyer_user_id: params.buyerUserId,
        sold_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .in("status", ["transferring", "active"]);
    return;
  }

  if (INVALID_FOR_RESALE.has(ticket.status)) {
    throw new DomainError(`Ticket cannot be transferred (status: ${ticket.status})`);
  }

  // Claim the ticket into `transferring` so a parallel cancel / refund
  // path cannot mutate it mid-transfer. Allow resume from already-transferring.
  if (ticket.status === "listed" && ticket.current_listing_id === listing.id) {
    const { data: ticketClaimed } = await sb
      .from("tickets")
      .update({ status: "transferring" })
      .eq("id", ticket.id)
      .eq("status", "listed")
      .eq("current_listing_id", listing.id)
      .select("id")
      .maybeSingle();
    if (!ticketClaimed) {
      throw new Error("Ticket no longer listable for this listing");
    }
  } else if (ticket.status !== "transferring" || ticket.current_listing_id !== listing.id) {
    throw new Error(`Ticket not in a transferable state (${ticket.status})`);
  }

  const { data: event } = await sb
    .from("events")
    .select("status, date, role_admin_address")
    .eq("id", ticket.event_id)
    .single<Pick<EventRow, "status" | "date" | "role_admin_address">>();
  if (event?.status === "canceled") throw new DomainError("Event canceled");
  if (event && new Date(event.date).getTime() < Date.now()) throw new DomainError("Event already passed");

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
  const roleAdmin = (event?.role_admin_address ?? (await backendWallet())) as Address;

  // Open or resume the chain_op for this listing.
  const { op, resumed } = await openOrResumeChainOp({
    opType: "transfer",
    listingId: listing.id,
    ticketId: ticket.id,
    contractAddress: ticket.nft_contract_address,
    tokenId: ticket.nft_token_id,
    fromAddress: sellerSmartAccount,
    toAddress: buyerSmartAccount,
  });

  let transferTxHash: string | null = null;
  try {
    const { txHash } = await runChainOp({
      op,
      resumed,
      from: roleAdmin,
      call: {
        contractAddress: ticket.nft_contract_address as Address,
        method:
          "function adminTransfer(address from, address to, uint256 tokenId)",
        params: [
          sellerSmartAccount as Address,
          buyerSmartAccount as Address,
          BigInt(ticket.nft_token_id),
        ],
      },
    });
    transferTxHash = txHash;
  } catch (err) {
    // ONLY a TransactionRevertError is a definitive pre-mined terminal
    // failure. Timeout, network errors during wait, RPC exceptions etc
    // may have a broadcasted tx mining underneath; compensating or
    // releasing on those failures would lose the NFT.
    if (err instanceof TransactionRevertError) {
      await sb
        .from("tickets")
        .update({ status: "listed" })
        .eq("id", ticket.id)
        .eq("status", "transferring")
        .eq("current_listing_id", listing.id);
      await sb
        .from("resale_listings")
        .update({ status: "active", buyer_user_id: null })
        .eq("id", listing.id)
        .eq("status", "transferring");

      const message = `adminTransfer reverted: ${err.record.errorMessage ?? "unknown"}`;
      await audit({
        actorUserId: params.buyerUserId,
        action: "resale.transfer_failed",
        entityType: "resale_listing",
        entityId: listing.id,
        metadata: {
          ticket_id: ticket.id,
          chain_op: op.id,
          contract: ticket.nft_contract_address,
          token_id: ticket.nft_token_id,
          from: sellerSmartAccount,
          to: buyerSmartAccount,
          error: message,
        },
      });
      throw new Error(message);
    }

    // In-flight / unknown — leave claimed, hand off to admin retry.
    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.transfer_pending",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        chain_op: op.id,
        transaction_id:
          err instanceof TransactionTimeoutError
            ? err.transactionId
            : op.transaction_id,
        reason: err instanceof Error ? err.message : "unknown",
      },
    });
    if (err instanceof TransactionTimeoutError) {
      throw new ResaleTransferPendingError(listing.id, err.transactionId);
    }
    throw new ResaleTransferPendingError(
      listing.id,
      op.transaction_id ?? undefined,
    );
  }

  // ---- Chain tx mined. No compensation past this point. -------------------
  try {
    // Move ticket from transferring → sold under the new owner.
    const { data: updated, error: ticketUpdateError } = await sb
      .from("tickets")
      .update({
        owner_user_id: params.buyerUserId,
        owner_evm_address: buyerSmartAccount,
        status: "sold",
        current_listing_id: null,
        last_transfer_tx_hash: transferTxHash,
      })
      .eq("id", ticket.id)
      .eq("status", "transferring")
      .eq("current_listing_id", listing.id)
      .select("id")
      .maybeSingle();
    if (ticketUpdateError) throw ticketUpdateError;
    if (!updated) {
      // Could be a duplicate mined retry where the ticket already
      // moved to sold. Tolerate; do not error.
      const { data: check } = await sb
        .from("tickets")
        .select("status, owner_user_id")
        .eq("id", ticket.id)
        .single<{ status: string; owner_user_id: string | null }>();
      if (!(check?.status === "sold" && check.owner_user_id === params.buyerUserId)) {
        throw new Error("Ticket transfer DB update failed");
      }
    }
  } catch (dbErr) {
    // Chain owner already moved. Do NOT compensate. Mark repair_needed.
    const message = dbErr instanceof Error ? dbErr.message : "db update failed";
    await sb
      .from("tickets")
      .update({ status: "repair_needed" })
      .eq("id", ticket.id)
      .eq("status", "transferring");
    await sb
      .from("resale_listings")
      .update({ status: "repair_needed" })
      .eq("id", listing.id)
      .eq("status", "transferring");
    await markChainOpRepairNeeded(op.id, message);
    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.db_update_failed",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        chain_op: op.id,
        tx_hash: transferTxHash,
        error: message,
      },
    });
    throw new ChainOpRepairError(op.id, transferTxHash, message);
  }

  // Listing finalize. A failure here lands as repair_needed.
  try {
    await sb
      .from("resale_listings")
      .update({
        status: "sold",
        buyer_user_id: params.buyerUserId,
        sold_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .in("status", ["transferring", "active"]);

    await sb.from("resale_seller_settlements").upsert({
      listing_id: listing.id,
      seller_user_id: listing.seller_user_id,
      amount: listing.price,
      currency: listing.currency,
      status: "pending_payout",
    }, { onConflict: "listing_id" });

    await markChainOpMined(op.id, transferTxHash);

    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.fulfill",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        chain_op: op.id,
        contract: ticket.nft_contract_address,
        token_id: ticket.nft_token_id,
        tx_hash: transferTxHash,
      },
    });
  } catch (finalErr) {
    const message = finalErr instanceof Error ? finalErr.message : "finalize failed";
    await markChainOpRepairNeeded(op.id, message);
    await audit({
      actorUserId: params.buyerUserId,
      action: "resale.finalize_failed",
      entityType: "resale_listing",
      entityId: listing.id,
      metadata: {
        ticket_id: ticket.id,
        chain_op: op.id,
        tx_hash: transferTxHash,
        error: message,
      },
    });
    throw new ChainOpRepairError(op.id, transferTxHash, message);
  }
}
