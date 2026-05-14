// Thirdweb Transactions API client (server-only).
//
// Path 2 / api.thirdweb.com style: every transaction is queued by the
// backend wallet (`x-backend-wallet-address`) and authorized by the
// account secret (`x-secret-key`). Both headers ship via the shared
// `thirdwebFetch` wrapper.
//
// We send raw encoded calldata so this module stays independent of
// individual contract endpoints — viem encodes, Thirdweb broadcasts.

import type { Address, Hex } from "viem";

import { ThirdwebError, thirdwebFetch } from "@/lib/thirdweb/client";

function chainId(): number {
  const raw = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!raw) throw new Error("Missing CHAIN_ID env var");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid CHAIN_ID: ${raw}`);
  return parsed;
}

export interface SendTransactionParams {
  to?: Address | null;
  data: Hex;
  value?: bigint;
}

export interface QueuedTransaction {
  transactionId: string;
}

interface SendTxResponse {
  result?: {
    transactionIds?: string[];
    transactionId?: string;
  };
  transactionIds?: string[];
  transactionId?: string;
}

function pickTransactionId(res: SendTxResponse): string {
  const ids =
    res.result?.transactionIds ??
    res.transactionIds ??
    (res.result?.transactionId ? [res.result.transactionId] : undefined) ??
    (res.transactionId ? [res.transactionId] : undefined);
  if (!ids || ids.length === 0) {
    throw new ThirdwebError(
      "Thirdweb send response missing transactionId",
      0,
      res,
    );
  }
  return ids[0];
}

export async function sendTransaction(
  params: SendTransactionParams,
): Promise<QueuedTransaction> {
  const tx: Record<string, unknown> = { data: params.data };
  if (params.to) tx.to = params.to;
  if (params.value !== undefined) tx.value = params.value.toString();

  const response = await thirdwebFetch<SendTxResponse>("/v1/transactions", {
    method: "POST",
    body: { chainId: chainId(), transactions: [tx] },
  });

  return { transactionId: pickTransactionId(response) };
}

export interface DeployContractParams {
  bytecode: Hex;
  /**
   * Already-encoded constructor args appended to the bytecode? Most callers
   * should pre-encode the full deploy data via `viem.encodeDeployData` and
   * pass it as `bytecode`. Constructor-args field is kept null for now to
   * avoid double-encoding.
   */
}

export async function deployContract(
  params: DeployContractParams,
): Promise<QueuedTransaction> {
  return sendTransaction({ to: null, data: params.bytecode });
}

export interface WriteContractParams {
  contractAddress: Address;
  data: Hex;
  value?: bigint;
}

export async function writeContract(
  params: WriteContractParams,
): Promise<QueuedTransaction> {
  return sendTransaction({
    to: params.contractAddress,
    data: params.data,
    value: params.value,
  });
}

export type TransactionStatus =
  | "QUEUED"
  | "SENT"
  | "MINED"
  | "ERRORED"
  | "CANCELLED";

export interface TransactionRecord {
  transactionId: string;
  status: TransactionStatus;
  transactionHash: Hex | null;
  contractAddress: Address | null;
  errorMessage: string | null;
}

interface StatusResponse {
  result?: {
    status?: string;
    transactionHash?: string;
    deployedContractAddress?: string;
    contractAddress?: string;
    errorMessage?: string;
  };
  status?: string;
  transactionHash?: string;
  deployedContractAddress?: string;
  contractAddress?: string;
  errorMessage?: string;
}

function normalizeStatus(raw: string | undefined): TransactionStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "MINED":
    case "SUCCESS":
    case "CONFIRMED":
      return "MINED";
    case "ERRORED":
    case "FAILED":
    case "REVERTED":
      return "ERRORED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "SENT":
    case "SUBMITTED":
      return "SENT";
    default:
      return "QUEUED";
  }
}

export async function getTransaction(
  transactionId: string,
): Promise<TransactionRecord> {
  const response = await thirdwebFetch<StatusResponse>(
    `/v1/transactions/${transactionId}`,
    { method: "GET" },
  );
  const data = response.result ?? response;
  return {
    transactionId,
    status: normalizeStatus(data.status),
    transactionHash: (data.transactionHash as Hex | undefined) ?? null,
    contractAddress:
      (data.deployedContractAddress as Address | undefined) ??
      (data.contractAddress as Address | undefined) ??
      null,
    errorMessage: data.errorMessage ?? null,
  };
}

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export class TransactionTimeoutError extends Error {
  constructor(readonly transactionId: string) {
    super(`Transaction ${transactionId} did not mine within timeout`);
    this.name = "TransactionTimeoutError";
  }
}

export class TransactionRevertError extends Error {
  constructor(
    readonly transactionId: string,
    readonly record: TransactionRecord,
  ) {
    super(
      `Transaction ${transactionId} reverted: ${record.errorMessage ?? "unknown error"}`,
    );
    this.name = "TransactionRevertError";
  }
}

export async function waitForTransaction(
  transactionId: string,
  options: WaitOptions = {},
): Promise<TransactionRecord> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const record = await getTransaction(transactionId);
    if (record.status === "MINED") return record;
    if (record.status === "ERRORED" || record.status === "CANCELLED") {
      throw new TransactionRevertError(transactionId, record);
    }
    await sleep(pollIntervalMs);
  }

  throw new TransactionTimeoutError(transactionId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
