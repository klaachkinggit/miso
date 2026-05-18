// Gate-based redemption pipeline.
//
// 1. Prepare: customer scans the gate QR. Server validates ownership + state
//    and returns a non-binding redemption intent (nonce + ticket/gate ids).
//    No on-chain operation happens here.
// 2. Confirm: server flips the ticket → used (DB source of truth) and then
//    writes the on-chain `Redeemed=true` attribute via the backend wallet.
//    Users never sign on chain.
//
// The DB flip is the source of truth: if the on-chain attribute write fails,
// the redemption still counts. The attribute can be backfilled by an admin
// retry tool. Dedup of concurrent flips relies on the conditional
// `status='sold'` update inside `markTicketRedeemed`.

import { randomBytes } from "node:crypto";

import type { Address } from "viem";

import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/api/errors";
import {
  gateAllowsTicketCategory,
  getGateSessionByShortCode,
  isGateSessionUsable,
  updateGateLastRedemption,
} from "@/lib/gates/operations";
import { createServiceClient } from "@/lib/supabase/service";
import {
  backendWallet,
  TransactionRevertError,
  TransactionTimeoutError,
  waitForTransaction,
  writeContract,
} from "@/lib/thirdweb/transactions";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import { markTicketRedeemed } from "@/lib/tickets/lifecycle";
import type {
  EventRow,
  GateSession,
  RedemptionResult,
  Ticket,
} from "@/types/db";

interface RedemptionIntent {
  type: "miso.redeem";
  ticket: string;
  event: string;
  gate: string;
  nonce: string;
  contract: string;
  token_id: number;
  version: 2;
}

interface PreparedRedemption {
  payload: RedemptionIntent;
  signer_wallet: string;
  tx_signature: string;
  signed: true;
  serialized_tx_b64: "";
  recent_blockhash: "";
  redemption_pda: "";
}

export interface PrepareResult {
  prepared: PreparedRedemption;
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

async function buyerSmartAccount(userId: string): Promise<string> {
  const sb = createServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single<{ email: string }>();
  if (!profile?.email) throw new Error("Profile missing email");
  const { smartAccountAddress } = await ensureUserWallet(userId, profile.email);
  return smartAccountAddress;
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
  if (ticket.owner_user_id !== params.userId) throw new DomainError("Not ticket owner");
  if (ticket.event_id !== gate.event_id) throw new DomainError("Ticket is for a different event");
  if (!gateAllowsTicketCategory(gate, ticket.category_id)) {
    throw new DomainError("Ticket category is not accepted at this gate");
  }
  if (ticket.status !== "sold") throw new Error(`Ticket not redeemable (status: ${ticket.status})`);
  if (!ticket.nft_contract_address || ticket.nft_token_id === null) {
    throw new Error("Ticket has no on-chain identity");
  }

  const smartAccount = await buyerSmartAccount(params.userId);
  const nonce = randomBytes(12).toString("hex");

  const prepared: PreparedRedemption = {
    payload: {
      type: "miso.redeem",
      ticket: ticket.id,
      event: ticket.event_id,
      gate: gate.id,
      nonce,
      contract: ticket.nft_contract_address,
      token_id: ticket.nft_token_id,
      version: 2,
    },
    signer_wallet: smartAccount,
    tx_signature: nonce,
    signed: true,
    serialized_tx_b64: "",
    recent_blockhash: "",
    redemption_pda: "",
  };

  return { prepared, gate, ticket };
}

async function recordRedemption(args: {
  ticket_id: string;
  event_id: string;
  controller_user_id: string;
  evm_address: string;
  result: RedemptionResult;
  gate_session_id: string | null;
  gate_name: string | null;
  redeem_tx_hash: string | null;
}): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("ticket_redemptions")
    .insert({
      ticket_id: args.ticket_id,
      event_id: args.event_id,
      controller_user_id: args.controller_user_id,
      evm_address: args.evm_address,
      result: args.result,
      gate_session_id: args.gate_session_id,
      gate_name: args.gate_name,
      redeem_tx_hash: args.redeem_tx_hash,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function recordAndPublishGateResult(args: {
  ticket_id: string;
  event_id: string;
  controller_user_id: string;
  evm_address: string;
  result: RedemptionResult;
  gate_session_id: string;
  gate_name: string | null;
  redeem_tx_hash: string | null;
}): Promise<string | null> {
  const redemption_id = await recordRedemption(args);
  if (redemption_id) {
    await updateGateLastRedemption({
      gateSessionId: args.gate_session_id,
      redemptionId: redemption_id,
      ticketId: args.ticket_id,
      result: args.result,
    });
  }
  return redemption_id;
}

export async function confirmRedemption(params: {
  userId: string;
  gateShortCode: string;
  ticketId: string;
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

  const smartAccount = await buyerSmartAccount(params.userId);

  if (ticket.event_id !== gate.event_id) {
    await recordAndPublishGateResult({
      ticket_id: ticket.id,
      event_id: gate.event_id,
      controller_user_id: gate.controller_user_id,
      evm_address: smartAccount,
      result: "wrong_event",
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_hash: null,
    });
    return { result: "wrong_event", reason: "Ticket belongs to another event" };
  }
  if (!gateAllowsTicketCategory(gate, ticket.category_id)) {
    await recordAndPublishGateResult({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      evm_address: smartAccount,
      result: "wrong_category",
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_hash: null,
    });
    return { result: "wrong_category", reason: "Ticket category is not accepted at this gate" };
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) return { result: "no_ticket", reason: "Event missing" };

  const failFast = (result: RedemptionResult, reason: string) =>
    recordAndPublishGateResult({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      evm_address: smartAccount,
      result,
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_hash: null,
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
  if (!ticket.nft_contract_address || ticket.nft_token_id === null) {
    return failFast("invalid_signature", "Ticket has no on-chain identity");
  }

  // Flip DB first — conditional on status='sold' so only one redemption wins.
  const flipped = await markTicketRedeemed({ ticketId: ticket.id });
  if (!flipped) {
    const redemption_id = await recordAndPublishGateResult({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      controller_user_id: gate.controller_user_id,
      evm_address: smartAccount,
      result: "already_used",
      gate_session_id: gate.id,
      gate_name: gate.gate_name,
      redeem_tx_hash: null,
    });
    return { result: "already_used", reason: "Concurrent redeem", redemption_id: redemption_id ?? undefined };
  }

  const redemption_id = await recordAndPublishGateResult({
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    controller_user_id: gate.controller_user_id,
    evm_address: smartAccount,
    result: "valid",
    gate_session_id: gate.id,
    gate_name: gate.gate_name,
    redeem_tx_hash: null,
  });

  // On-chain attribute write — DB flip already committed. Failure logs
  // an audit entry; admin retry tool can backfill the attribute.
  let redeemTxHash: string | null = null;
  const roleAdmin = (event.role_admin_address ?? (await backendWallet())) as Address;
  // Bind idempotency to the redemption row id when we have one — that
  // way an admin replay (e.g. after a previous attempt's revert) does
  // not collide with the prior key. Falls back to ticket id if the
  // redemption row insert failed.
  const redeemIdempotencyKey = `redeem:${redemption_id ?? ticket.id}`;
  try {
    const queued = await writeContract({
      contractAddress: ticket.nft_contract_address as Address,
      method:
        "function setAttribute(uint256 tokenId, string key, string value)",
      params: [BigInt(ticket.nft_token_id), "Redeemed", "true"],
      from: roleAdmin,
      idempotencyKey: redeemIdempotencyKey,
    });
    const record = await waitForTransaction(queued.transactionId, {
      timeoutMs: 180_000,
    });
    redeemTxHash = record.transactionHash ?? null;
  } catch (err) {
    const message =
      err instanceof TransactionRevertError
        ? `setAttribute reverted: ${err.record.errorMessage ?? "unknown"}`
        : err instanceof TransactionTimeoutError
          ? `setAttribute timed out (transactionId=${err.transactionId})`
          : err instanceof Error
            ? err.message
            : "setAttribute failed";
    await audit({
      actorUserId: gate.controller_user_id,
      action: "redemption.attribute_failed",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        contract: ticket.nft_contract_address,
        token_id: ticket.nft_token_id,
        gate_session_id: gate.id,
        redemption_id,
        error: message,
      },
    });
  }

  if (redeemTxHash) {
    await sb
      .from("tickets")
      .update({ redeem_tx_hash: redeemTxHash })
      .eq("id", ticket.id);
    if (redemption_id) {
      await sb
        .from("ticket_redemptions")
        .update({ redeem_tx_hash: redeemTxHash })
        .eq("id", redemption_id);
    }
    await audit({
      actorUserId: gate.controller_user_id,
      action: "redemption.attribute_set",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        contract: ticket.nft_contract_address,
        token_id: ticket.nft_token_id,
        tx_hash: redeemTxHash,
        gate_session_id: gate.id,
        redemption_id,
      },
    });
  }

  return {
    result: "valid",
    redemption_id: redemption_id ?? undefined,
    redeem_tx_signature: redeemTxHash ?? undefined,
    attr_tx_signature: redeemTxHash ?? undefined,
  };
}
