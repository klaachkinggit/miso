// Gate-based redemption pipeline for the demo branch.
//
// 1. Prepare: customer chose ticket, backend builds a synthetic redeem payload.
// 2. Confirm: backend verifies the demo payload, records a demo attribute
//    signature, then flips DB state atomically through the Ticket lifecycle.

import { createServiceClient } from "@/lib/supabase/service";
import {
  demoRedemptionPda,
  demoTicketAssetAddressFor,
  prepareDemoRedeem,
  verifyDemoRedeem,
  writeDemoRedemptionAttribute,
  type PreparedDemoRedeem,
  type SignedDemoRedeem,
} from "@/lib/demo/artifacts";
import { getGateSessionByShortCode, isGateSessionUsable, updateGateLastRedemption } from "@/lib/gates/operations";
import { markTicketRedeemed } from "@/lib/tickets/lifecycle";
import type {
  EventRow,
  GateSession,
  RedemptionResult,
  Ticket,
  Wallet,
} from "@/types/db";

export interface PrepareResult {
  prepared: PreparedDemoRedeem | SignedDemoRedeem;
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
  const assetAddress = demoTicketAssetAddressFor(ticket);

  const { data: wallet } = await sb
    .from("wallets")
    .select("wallet_address, wallet_type")
    .eq("user_id", params.userId)
    .eq("is_primary", true)
    .single<Pick<Wallet, "wallet_address" | "wallet_type">>();
  if (!wallet) throw new Error("No wallet for user");

  const prepared = await prepareDemoRedeem({
    ticketId: ticket.id,
    eventId: ticket.event_id,
    gateSessionId: gate.id,
    assetAddress,
    signerWallet: wallet.wallet_address,
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
  const assetAddress = demoTicketAssetAddressFor(ticket);

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

  await verifyDemoRedeem();

  const redemption_pda = demoRedemptionPda(ticket.event_id, assetAddress);
  const { signature: attr_sig } = await writeDemoRedemptionAttribute();

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

  const redeemed = await markTicketRedeemed({
    ticketId: ticket.id,
    txSignature: params.txSignature,
    redemptionPda: redemption_pda,
    signerWallet: params.signerWallet,
  });
  if (!redeemed) {
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
