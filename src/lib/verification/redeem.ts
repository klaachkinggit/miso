// Gate-based redemption pipeline (Path B, mpl-core).
//
// 1. Prepare: customer chose ticket, backend builds a Memo tx.
//      Custodial → backend signs + submits immediately, returns tx_signature.
//      External  → returns base64 unsigned tx for client signing + submission.
// 2. Confirm: backend verifies the tx (signature, memo payload, on-chain owner),
//    writes the on-chain redemption attribute via treasury, then flips DB
//    state atomically (guarded by ticket.status='sold' + unique signature).

import { createServiceClient } from "@/lib/supabase/service";
import { isDemoMode } from "@/lib/demo";
import {
  buildRedeemTx,
  verifyRedeemTx,
  writeOnchainRedemptionAttribute,
  deriveRedemptionPda,
  type CustodialSignedRedeemTx,
  type PreparedRedeemTx,
  type RedeemMemoPayload,
} from "@/lib/solana/redeem-tx";
import { getGateSessionByShortCode, isGateSessionUsable, updateGateLastRedemption } from "@/lib/gates/session";
import type {
  EventRow,
  GateSession,
  RedemptionResult,
  Ticket,
  Wallet,
} from "@/types/db";

function ticketAssetAddress(ticket: Pick<Ticket, "id" | "nft_asset_address">): string | null {
  if (ticket.nft_asset_address) return ticket.nft_asset_address;
  if (isDemoMode()) return `demo_asset_${ticket.id}`;
  return null;
}

export interface PrepareResult {
  prepared: PreparedRedeemTx | CustodialSignedRedeemTx;
  gate: GateSession;
  ticket: Ticket;
}

export interface ConfirmOutcome {
  result: RedemptionResult;
  reason?: string;
  redemption_id?: string;
  redeem_tx_signature?: string;
  attr_tx_signature?: string;
}

export async function prepareRedemption(params: {
  userId: string;
  gateShortCode: string;
  ticketId: string;
}): Promise<PrepareResult> {
  const sb = createServiceClient();

  const gate = await getGateSessionByShortCode(params.gateShortCode);
  if (!gate) throw new Error("Gate not found");
  if (!isGateSessionUsable(gate)) throw new Error("Gate closed or expired");

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", params.ticketId)
    .single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.owner_user_id !== params.userId) throw new Error("Not ticket owner");
  if (ticket.event_id !== gate.event_id) throw new Error("Ticket is for a different event");
  if (ticket.status !== "sold") throw new Error(`Ticket not redeemable (status: ${ticket.status})`);
  const assetAddress = ticketAssetAddress(ticket);
  if (!assetAddress) throw new Error("Ticket NFT missing");

  const { data: wallet } = await sb
    .from("wallets")
    .select("wallet_address, wallet_type")
    .eq("user_id", params.userId)
    .eq("is_primary", true)
    .single<Pick<Wallet, "wallet_address" | "wallet_type">>();
  if (!wallet) throw new Error("No wallet for user");

  const prepared = await buildRedeemTx({
    ticketId: ticket.id,
    eventId: ticket.event_id,
    gateSessionId: gate.id,
    assetAddress,
    signerWallet: wallet.wallet_address,
    walletType: wallet.wallet_type,
    custodialUserId: wallet.wallet_type === "custodial" ? params.userId : undefined,
  });

  return { prepared, gate, ticket };
}

async function recordRedemption(args: {
  ticket_id: string;
  event_id: string;
  controller_user_id: string;
  wallet_address: string;
  signature: string | null;
  result: RedemptionResult;
  gate_session_id: string | null;
  gate_name: string | null;
  redeem_tx_signature: string | null;
  redemption_pda: string | null;
}): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("ticket_redemptions")
    .insert({
      ticket_id: args.ticket_id,
      event_id: args.event_id,
      controller_user_id: args.controller_user_id,
      wallet_address: args.wallet_address,
      signature: args.signature,
      result: args.result,
      gate_session_id: args.gate_session_id,
      gate_name: args.gate_name,
      redeem_tx_signature: args.redeem_tx_signature,
      redemption_pda: args.redemption_pda,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function confirmRedemption(params: {
  userId: string;
  gateShortCode: string;
  ticketId: string;
  txSignature: string;
  signerWallet: string;
  nonce: string;
}): Promise<ConfirmOutcome> {
  const sb = createServiceClient();

  const gate = await getGateSessionByShortCode(params.gateShortCode);
  if (!gate) return { result: "no_session", reason: "Gate not found" };
  if (!isGateSessionUsable(gate)) return { result: "no_session", reason: "Gate closed/expired" };

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", params.ticketId)
    .single<Ticket>();
  if (!ticket) return { result: "no_ticket", reason: "Ticket not found" };
  if (ticket.owner_user_id !== params.userId) {
    return { result: "owner_mismatch", reason: "Not ticket owner" };
  }
  if (ticket.event_id !== gate.event_id) {
    await recordRedemption({
      ticket_id: ticket.id,
      event_id: gate.event_id,
      controller_user_id: gate.controller_user_id,
      wallet_address: params.signerWallet,
      signature: params.txSignature,
      result: "wrong_event",
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_signature: params.txSignature,
      redemption_pda: null,
    });
    return { result: "wrong_event", reason: "Ticket belongs to another event" };
  }
  const assetAddress = ticketAssetAddress(ticket);
  if (!assetAddress) return { result: "no_ticket", reason: "Ticket NFT missing" };

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) return { result: "no_ticket", reason: "Event missing" };

  // Pre-status checks.
  const failFast = (result: RedemptionResult, reason: string) =>
    recordRedemption({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      wallet_address: params.signerWallet,
      signature: params.txSignature,
      result,
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_signature: params.txSignature,
      redemption_pda: null,
    }).then(() => ({ result, reason }));

  if (ticket.status === "used") return failFast("already_used", "Ticket already used");
  if (ticket.status === "refund_pending" || ticket.status === "refunded") {
    return failFast("refunded", "Ticket refunded");
  }
  if (ticket.status === "canceled" || event.status === "canceled") {
    return failFast("canceled", "Ticket canceled");
  }
  if (ticket.status === "expired") return failFast("expired", "Ticket expired");
  if (ticket.status !== "sold") return failFast("invalid_signature", `Bad status ${ticket.status}`);

  // Verify the customer tx.
  const expectedPayload: RedeemMemoPayload = {
    type: "miso.redeem",
    ticket: ticket.id,
    event: ticket.event_id,
    gate: gate.id,
    nonce: params.nonce,
    asset: assetAddress,
    version: 1,
  };
  const v = await verifyRedeemTx({
    txSignature: params.txSignature,
    expectedPayload,
    expectedSigner: params.signerWallet,
    assetAddress,
  });
  if (!v.ok) {
    const result: RedemptionResult = v.reason.includes("owner") ? "owner_mismatch" : "invalid_signature";
    await recordRedemption({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      wallet_address: params.signerWallet,
      signature: params.txSignature,
      result,
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_signature: params.txSignature,
      redemption_pda: null,
    });
    return { result, reason: v.reason };
  }

  const redemption_pda = deriveRedemptionPda(ticket.event_id, assetAddress);

  // Treasury writes used=true attribute on-chain. Idempotent.
  let attr_sig = "";
  try {
    const r = await writeOnchainRedemptionAttribute({
      assetAddress,
      collectionAddress: event.solana_collection_address,
      nonce: params.nonce,
      txSignature: params.txSignature,
    });
    attr_sig = r.signature;
  } catch (error) {
    console.error("On-chain attribute write failed", error);
    // The customer's redemption tx already confirmed; ticket stays valid for retry.
    await recordRedemption({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      wallet_address: params.signerWallet,
      signature: params.txSignature,
      result: "tx_failed",
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_signature: params.txSignature,
      redemption_pda,
    });
    return { result: "tx_failed", reason: "On-chain attribute write failed; retry" };
  }

  // Insert redemption row first — dedupe via unique idx on redemption_pda.
  const redemption_id = await recordRedemption({
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    controller_user_id: gate.controller_user_id,
    wallet_address: params.signerWallet,
    signature: params.txSignature,
    result: "valid",
    gate_session_id: gate.id,
    gate_name: gate.gate_name,
    redeem_tx_signature: params.txSignature,
    redemption_pda,
  });
  if (!redemption_id) {
    // Race lost: another redemption already inserted for this PDA.
    return { result: "already_used", reason: "Concurrent redeem" };
  }

  // Flip ticket guarded by current status.
  const { data: flipped } = await sb
    .from("tickets")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      redeem_tx_signature: params.txSignature,
      redemption_pda,
      redeemed_wallet_address: params.signerWallet,
    })
    .eq("id", ticket.id)
    .eq("status", "sold")
    .select("id")
    .maybeSingle();
  if (!flipped) {
    // Race: someone else already flipped → mark this row as already_used.
    await sb
      .from("ticket_redemptions")
      .update({ result: "already_used" })
      .eq("id", redemption_id);
    await updateGateLastRedemption({
      gateSessionId: gate.id,
      redemptionId: redemption_id,
      ticketId: ticket.id,
      result: "already_used",
    });
    return { result: "already_used", redemption_id, redeem_tx_signature: params.txSignature };
  }

  await updateGateLastRedemption({
    gateSessionId: gate.id,
    redemptionId: redemption_id,
    ticketId: ticket.id,
    result: "valid",
  });

  return {
    result: "valid",
    redemption_id,
    redeem_tx_signature: params.txSignature,
    attr_tx_signature: attr_sig,
  };
}
