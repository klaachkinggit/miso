// chain_ops helper.
//
// Persists an "in-flight" record for every mint / adminTransfer BEFORE
// the chain call. On retry we look up the existing row, reuse the
// Thirdweb transactionId, and wait on the original submission instead
// of broadcasting a second one under a different idempotency key.
//
// The unique partial indexes in 0013 prevent two live ops from existing
// for the same purchase / listing simultaneously: an errored row may be
// superseded by a fresh attempt only after compensation has reversed
// the buyer-side state.

import { createServiceClient } from "@/lib/supabase/service";
import {
  TransactionRevertError,
  TransactionTimeoutError,
  waitForTransaction,
  writeContract,
  type WriteContractCall,
} from "@/lib/thirdweb/transactions";
import type { Address } from "viem";
import type { ChainOp } from "@/types/db";

type ChainOpType = "mint" | "transfer" | "wallet_export";

export interface OpenChainOpInput {
  opType: ChainOpType;
  purchaseId?: string;
  listingId?: string;
  ticketId: string;
  contractAddress: string;
  tokenId: number;
  fromAddress?: string | null;
  toAddress: string;
  metadataUri?: string | null;
}

// Looks up the live op for the given purchase/listing or inserts a new
// one. Returns the row + a boolean indicating whether it was reused.
// "Live" = status in queued|sent|mined|repair_needed; an `errored` row
// is treated as terminal and a new attempt is created.
//
// Concurrency: the partial unique indexes
// (chain_ops_mint_live_uniq / chain_ops_transfer_live_uniq) serialize
// concurrent claimants. If two callers race past the SELECT, one wins
// the INSERT and the other gets a 23505. We catch that and re-read the
// live row so both callers end up resuming the same op.
export async function openOrResumeChainOp(
  input: OpenChainOpInput,
): Promise<{ op: ChainOp; resumed: boolean }> {
  const sb = createServiceClient();

  if (input.opType === "mint" && !input.purchaseId) {
    throw new Error("mint op requires purchaseId");
  }
  if (input.opType === "transfer" && !input.listingId) {
    throw new Error("transfer op requires listingId");
  }

  const findLive = async (): Promise<ChainOp | null> => {
    const liveStatuses: string[] = ["queued", "sent", "mined", "repair_needed"];
    let query = sb
      .from("chain_ops")
      .select("*")
      .eq("op_type", input.opType)
      .in("status", liveStatuses);
    if (input.opType === "mint") {
      query = query.eq("purchase_id", input.purchaseId!);
    } else if (input.opType === "transfer") {
      query = query.eq("listing_id", input.listingId!);
    } else {
      query = query.eq("ticket_id", input.ticketId);
    }
    const { data } = await query.maybeSingle<ChainOp>();
    return data ?? null;
  };

  const findNextAttempt = async (): Promise<number> => {
    let attemptQuery = sb
      .from("chain_ops")
      .select("attempt")
      .eq("op_type", input.opType)
      .order("attempt", { ascending: false })
      .limit(1);
    if (input.opType === "mint") {
      attemptQuery = attemptQuery.eq("purchase_id", input.purchaseId!);
    } else if (input.opType === "transfer") {
      attemptQuery = attemptQuery.eq("listing_id", input.listingId!);
    } else {
      attemptQuery = attemptQuery.eq("ticket_id", input.ticketId);
    }
    const { data: prior } = await attemptQuery.maybeSingle<{ attempt: number }>();
    return prior ? prior.attempt + 1 : 1;
  };

  // Retry loop tolerates the unique-violation race: if two workers
  // claim concurrently, the loser re-reads and either finds the
  // winner's live row (resume) or computes a fresh attempt number.
  for (let i = 0; i < 3; i++) {
    const existing = await findLive();
    if (existing) return { op: existing, resumed: true };

    const nextAttempt = await findNextAttempt();
    const idempotencyKey =
      input.opType === "mint"
        ? `mint:${input.purchaseId}:${nextAttempt}`
        : input.opType === "transfer"
          ? `transfer:${input.listingId}:${nextAttempt}`
          : `wallet_export:${input.ticketId}:${nextAttempt}`;

    const { data: inserted, error } = await sb
      .from("chain_ops")
      .insert({
        op_type: input.opType,
        purchase_id: input.opType === "mint" ? input.purchaseId! : null,
        listing_id: input.opType === "transfer" ? input.listingId! : null,
        ticket_id: input.ticketId,
        contract_address: input.contractAddress,
        token_id: input.tokenId,
        from_address: input.fromAddress ?? null,
        to_address: input.toAddress,
        idempotency_key: idempotencyKey,
        metadata_uri: input.metadataUri ?? null,
        attempt: nextAttempt,
        status: "queued",
      })
      .select("*")
      .single<ChainOp>();

    if (inserted) return { op: inserted, resumed: false };

    // 23505 = unique_violation. Another worker won the race. Re-read.
    const isUniqueViolation =
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505";
    if (!isUniqueViolation) throw error ?? new Error("chain_op insert failed");
  }

  // Three retries lost. Surface as in-flight so caller treats as pending.
  throw new Error(
    `Could not claim chain_op after retries (op_type=${input.opType})`,
  );
}

async function recordChainOpTransactionId(
  opId: string,
  transactionId: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("chain_ops")
    .update({ transaction_id: transactionId, status: "sent" })
    .eq("id", opId);
}

export async function markChainOpMined(
  opId: string,
  txHash: string | null,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("chain_ops")
    .update({ status: "mined", tx_hash: txHash })
    .eq("id", opId);
}

async function markChainOpErrored(
  opId: string,
  message: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("chain_ops")
    .update({ status: "errored", error_message: message })
    .eq("id", opId);
}

export async function markChainOpRepairNeeded(
  opId: string,
  message: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("chain_ops")
    .update({ status: "repair_needed", error_message: message })
    .eq("id", opId);
}

export interface RunChainOpResult {
  txHash: string;
}

// Submits the call (or resumes an existing submission) and waits for
// MINED. Distinguishes:
//   - resumed-with-tx          → wait on existing tx
//   - resumed-without-tx       → re-broadcast under same idempotency key
//   - fresh                    → broadcast + persist tx id
//
// Throws TransactionTimeoutError or TransactionRevertError untouched
// so callers can branch on type. On revert the op is marked errored
// in place; the caller decides whether to compensate.
export async function runChainOp(args: {
  op: ChainOp;
  resumed: boolean;
  call: WriteContractCall;
  from: Address;
  timeoutMs?: number;
}): Promise<RunChainOpResult> {
  const { op, resumed, call, from } = args;
  const timeoutMs = args.timeoutMs ?? 180_000;

  // If we already have a transactionId on the op, just wait on it.
  if (resumed && op.transaction_id) {
    try {
      const record = await waitForTransaction(op.transaction_id, { timeoutMs });
      return { txHash: record.transactionHash ?? "" };
    } catch (err) {
      if (err instanceof TransactionRevertError) {
        await markChainOpErrored(op.id, err.record.errorMessage ?? "reverted");
      }
      throw err;
    }
  }

  // Broadcast under the op's idempotency key. Thirdweb's idempotency
  // contract: same key → same record. A previously errored tx under
  // an older key is invisible because each attempt uses a fresh key.
  let transactionId = op.transaction_id;
  if (!transactionId) {
    const queued = await writeContract({
      ...call,
      from,
      idempotencyKey: op.idempotency_key,
    });
    transactionId = queued.transactionId;
    await recordChainOpTransactionId(op.id, transactionId);
  }

  try {
    const record = await waitForTransaction(transactionId, { timeoutMs });
    return { txHash: record.transactionHash ?? "" };
  } catch (err) {
    if (err instanceof TransactionRevertError) {
      await markChainOpErrored(op.id, err.record.errorMessage ?? "reverted");
    }
    throw err;
  }
}

// Thrown when a non-revert error occurs AFTER the chain op was opened.
// The tx may already have been broadcast / be mining; callers MUST NOT
// release reservations or compensate payment state. Settlement + checkout
// translate this into a 202 / pending purchase that admin retry resumes.
export class ChainOpInFlightError extends Error {
  constructor(
    readonly opId: string,
    readonly transactionId: string | null,
    cause: Error,
  ) {
    super(`Chain op ${opId} is in flight: ${cause.message}`);
    this.name = "ChainOpInFlightError";
  }
}

// Thrown when the chain tx mined but the follow-up DB write failed.
// Token exists on chain; DB does not. Caller MUST NOT compensate. Admin
// reconciles via the chain_ops row marked `repair_needed`.
export class ChainOpRepairError extends Error {
  constructor(
    readonly opId: string,
    readonly txHash: string | null,
    message: string,
  ) {
    super(`Chain op ${opId} needs repair (tx ${txHash ?? "?"}): ${message}`);
    this.name = "ChainOpRepairError";
  }
}

export { TransactionRevertError, TransactionTimeoutError };

// Single classifier for chain-op errors. Callers ask one question
// ("can I compensate?") instead of re-listing the four error classes
// across settlement + resale. Returning a discriminated union also lets
// audit logs and pending-state writes pick the right `state` label
// without each path re-encoding the rule.
export type ChainErrorClass =
  | { kind: "non_compensatable"; state: "in_flight" | "repair_needed" }
  | { kind: "compensatable" };

const NON_COMPENSATABLE_NAMES = new Set([
  "TransactionTimeoutError",
  "ChainOpInFlightError",
  "ChainOpRepairError",
]);

export function classifyChainError(error: unknown): ChainErrorClass {
  if (
    error instanceof ChainOpRepairError ||
    (error instanceof Error && error.name === "ChainOpRepairError")
  ) {
    return { kind: "non_compensatable", state: "repair_needed" };
  }
  if (
    error instanceof ChainOpInFlightError ||
    error instanceof TransactionTimeoutError ||
    (error instanceof Error && NON_COMPENSATABLE_NAMES.has(error.name))
  ) {
    return { kind: "non_compensatable", state: "in_flight" };
  }
  return { kind: "compensatable" };
}
