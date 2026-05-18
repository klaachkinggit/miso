import type { Address } from "viem";
import { audit } from "@/lib/audit";
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
import { backendWallet } from "@/lib/thirdweb/transactions";
import type { EventRow, Ticket } from "@/types/db";

const EXPORT_BLOCKED_STATUSES = new Set([
  "available",
  "reserved",
  "listed",
  "minting",
  "refund_pending",
  "refunded",
  "canceled",
  "repair_needed",
]);

export async function transferTicketToPersonalWallet(params: {
  ticketId: string;
  userId: string;
  destinationAddress: Address;
}): Promise<{ txHash: string | null }> {
  const sb = createServiceClient();

  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", params.ticketId)
    .single<Ticket>();
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.owner_user_id !== params.userId) throw new Error("Not ticket owner");
  if (ticket.transferred_off_platform_at) throw new Error("Ticket already transferred to a personal wallet");
  if (EXPORT_BLOCKED_STATUSES.has(ticket.status)) {
    throw new Error(`Ticket cannot be transferred (status: ${ticket.status})`);
  }
  if (!ticket.nft_contract_address || ticket.nft_token_id === null || !ticket.owner_evm_address) {
    throw new Error("Ticket has no on-chain identity");
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", ticket.event_id)
    .single<EventRow>();
  if (!event) throw new Error("Event not found");

  const eventPassed = new Date(event.date).getTime() < Date.now();
  const consumed = ticket.status === "used" || ticket.used_at !== null;
  if (!eventPassed && !consumed) {
    throw new Error("Personal wallet transfer is only available after the event or after redemption.");
  }

  const finalStatus = consumed || ticket.used_at ? "used" : "sold";
  const isResumable = ticket.status === "transferring";
  if (!isResumable) {
    const { data: claimed } = await sb
      .from("tickets")
      .update({ status: "transferring" })
      .eq("id", ticket.id)
      .eq("status", ticket.status)
      .is("transferred_off_platform_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Ticket is already being transferred");
  }

  const roleAdmin = (event.role_admin_address ?? (await backendWallet())) as Address;
  const { op, resumed } = await openOrResumeChainOp({
    opType: "wallet_export",
    ticketId: ticket.id,
    contractAddress: ticket.nft_contract_address,
    tokenId: ticket.nft_token_id,
    fromAddress: ticket.owner_evm_address,
    toAddress: params.destinationAddress,
  });

  let txHash: string | null = null;
  try {
    const result = await runChainOp({
      op,
      resumed,
      from: roleAdmin,
      call: {
        contractAddress: ticket.nft_contract_address as Address,
        method: "function adminTransfer(address from, address to, uint256 tokenId)",
        params: [
          ticket.owner_evm_address as Address,
          params.destinationAddress,
          BigInt(ticket.nft_token_id),
        ],
      },
    });
    txHash = result.txHash;
  } catch (err) {
    if (err instanceof TransactionRevertError) {
      await sb
        .from("tickets")
        .update({ status: finalStatus })
        .eq("id", ticket.id)
        .eq("status", "transferring");
      await audit({
        actorUserId: params.userId,
        action: "ticket.wallet_export_failed",
        entityType: "ticket",
        entityId: ticket.id,
        metadata: { error: err.record.errorMessage ?? "reverted", chain_op: op.id },
      });
      throw new Error(`Wallet export reverted: ${err.record.errorMessage ?? "unknown"}`);
    }
    await audit({
      actorUserId: params.userId,
      action: "ticket.wallet_export_pending",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        chain_op: op.id,
        transaction_id: err instanceof TransactionTimeoutError ? err.transactionId : op.transaction_id,
      },
    });
    throw new ChainOpInFlightError(
      op.id,
      op.transaction_id,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  try {
    const { error } = await sb
      .from("tickets")
      .update({
        status: finalStatus,
        owner_evm_address: params.destinationAddress,
        transferred_to_address: params.destinationAddress,
        transferred_off_platform_at: new Date().toISOString(),
        last_transfer_tx_hash: txHash,
      })
      .eq("id", ticket.id)
      .eq("status", "transferring");
    if (error) throw error;

    await markChainOpMined(op.id, txHash);
    await audit({
      actorUserId: params.userId,
      action: "ticket.wallet_export",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        chain_op: op.id,
        tx_hash: txHash,
        to: params.destinationAddress,
      },
    });
    return { txHash };
  } catch (dbErr) {
    const message = dbErr instanceof Error ? dbErr.message : "db update failed";
    await sb
      .from("tickets")
      .update({ status: "repair_needed" })
      .eq("id", ticket.id)
      .eq("status", "transferring");
    await markChainOpRepairNeeded(op.id, message);
    throw new ChainOpRepairError(op.id, txHash, message);
  }
}
