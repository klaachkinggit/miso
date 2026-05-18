// Thirdweb api.thirdweb.com client (server-only).
//
// Three operations:
//   - deployContract → POST /v1/contracts          ({bytecode, abi, constructorParams})
//   - writeContract  → POST /v1/contracts/write    ({contractAddress, method, params})
//   - waitForTransaction → polls /v1/transactions/{id} until MINED
//
// Auth: `x-secret-key` header (configured in client.ts). `from` is the
// Server Wallet EOA — defaulted from THIRDWEB_BACKEND_WALLET_ADDRESS so
// callers don't repeat it.

import {
  createPublicClient,
  decodeAbiParameters,
  http,
  keccak256,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { base, baseSepolia } from "viem/chains";

import { ThirdwebError, thirdwebFetch } from "@/lib/thirdweb/client";

function chainId(): number {
  const raw = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!raw) throw new Error("Missing CHAIN_ID env var");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid CHAIN_ID: ${raw}`);
  return parsed;
}

// Resolves the wallet whose msg.sender will appear at the target contract.
// Thirdweb's api.thirdweb.com routes EOA-typed Server Wallets through a
// 7702 → bundler path where msg.sender at the destination is the project's
// ERC-4337 smart account, NOT the EOA. Admin roles must therefore live on
// the smart wallet, and `from` on every write must be the smart wallet.
//
// THIRDWEB_BACKEND_SMART_WALLET_ADDRESS is the preferred env. We fall back
// to fetching /v1/wallets/server once on first use and cache the result.
let cachedFrom: Address | undefined;
let cachedFromPromise: Promise<Address> | undefined;

async function fetchSmartWallet(): Promise<Address> {
  const { thirdwebFetch } = await import("@/lib/thirdweb/client");
  const resp = await thirdwebFetch<{
    result?: {
      wallets?: Array<{ address?: string; smartWalletAddress?: string }>;
    };
  }>("/v1/wallets/server", { method: "GET" });
  const wallet = resp.result?.wallets?.[0];
  const smart = wallet?.smartWalletAddress as Address | undefined;
  if (!smart) {
    throw new Error("No smartWalletAddress on the project's Server Wallet");
  }
  return smart;
}

export async function backendWallet(): Promise<Address> {
  if (cachedFrom) return cachedFrom;
  const envSmart = process.env.THIRDWEB_BACKEND_SMART_WALLET_ADDRESS;
  if (envSmart) {
    cachedFrom = envSmart as Address;
    return cachedFrom;
  }
  if (!cachedFromPromise) {
    cachedFromPromise = fetchSmartWallet().then((addr) => {
      cachedFrom = addr;
      return addr;
    }).catch((err) => {
      cachedFromPromise = undefined;
      throw err;
    });
  }
  return cachedFromPromise;
}

export interface QueuedTransaction {
  transactionId: string;
}

export interface DeployContractParams {
  bytecode: Hex;
  abi: Abi;
  constructorParams: Record<string, unknown>;
  chainId?: number;
  from?: Address;
  salt?: string;
}

export interface DeployContractResult {
  address: Address;
  transactionId: string;
}

interface DeployResponse {
  result?: {
    address?: string;
    transactionId?: string;
    chainId?: number;
  };
}

export async function deployContract(
  params: DeployContractParams,
): Promise<DeployContractResult> {
  const body: Record<string, unknown> = {
    chainId: params.chainId ?? chainId(),
    bytecode: params.bytecode,
    abi: params.abi,
    constructorParams: params.constructorParams,
    from: params.from ?? (await backendWallet()),
  };
  if (params.salt) body.salt = params.salt;

  const response = await thirdwebFetch<DeployResponse>("/v1/contracts", {
    method: "POST",
    body,
  });
  const result = response.result;
  if (!result?.address || !result.transactionId) {
    throw new ThirdwebError(
      "Thirdweb /v1/contracts response missing address or transactionId",
      0,
      response,
    );
  }
  return {
    address: result.address as Address,
    transactionId: result.transactionId,
  };
}

export interface WriteContractCall {
  contractAddress: Address;
  method: string;
  params: unknown[];
  value?: bigint;
  gasLimit?: number | bigint;
}

export interface WriteContractParams extends WriteContractCall {
  chainId?: number;
  from?: Address;
  idempotencyKey?: string;
}

interface WriteResponse {
  result?: {
    transactionIds?: string[];
  };
}

const DEFAULT_WRITE_GAS_LIMIT = 500_000;
const RECEIPT_CHECK_TIMEOUT_MS = 60_000;
const USER_OPERATION_EVENT_TOPIC = keccak256(
  toHex("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"),
);

function normalizeGasLimit(value: number | bigint): number {
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`Invalid gasLimit: ${value.toString()}`);
  }
  return n;
}

export async function writeContract(
  params: WriteContractParams,
): Promise<QueuedTransaction> {
  const call: Record<string, unknown> = {
    contractAddress: params.contractAddress,
    method: params.method,
    params: params.params.map((p) => (typeof p === "bigint" ? p.toString() : p)),
  };
  if (params.value !== undefined) call.value = params.value.toString();
  // Thirdweb can under-estimate ERC-4337 callGasLimit for contract writes
  // (observed 27,955 gas for ERC721 mint needing ~160k), producing a
  // successful EntryPoint tx with a failed inner user operation.
  call.gasLimit = normalizeGasLimit(params.gasLimit ?? DEFAULT_WRITE_GAS_LIMIT);

  const body: Record<string, unknown> = {
    calls: [call],
    chainId: params.chainId ?? chainId(),
    from: params.from ?? (await backendWallet()),
  };
  if (params.idempotencyKey) body.idempotencyKey = params.idempotencyKey;

  const response = await thirdwebFetch<WriteResponse>("/v1/contracts/write", {
    method: "POST",
    body,
  });
  const ids = response.result?.transactionIds;
  if (!ids || ids.length === 0) {
    throw new ThirdwebError(
      "Thirdweb /v1/contracts/write response missing transactionIds",
      0,
      response,
    );
  }
  return { transactionId: ids[0] };
}

type TransactionStatus =
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
    case "PENDING":
      return "SENT";
    default:
      return "QUEUED";
  }
}

async function getTransaction(
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

function publicChain() {
  switch (chainId()) {
    case baseSepolia.id:
      return baseSepolia;
    case base.id:
      return base;
    default:
      return null;
  }
}

async function minedReceipt(record: TransactionRecord): Promise<TransactionReceipt | null> {
  if (!record.transactionHash) return null;
  const chain = publicChain();
  if (!chain) return null;
  const client = createPublicClient({ chain, transport: http() });
  try {
    return await client.waitForTransactionReceipt({
      hash: record.transactionHash,
      timeout: RECEIPT_CHECK_TIMEOUT_MS,
    });
  } catch {
    return null;
  }
}

function topicAddress(topic: Hex | undefined): Address | null {
  if (!topic) return null;
  return `0x${topic.slice(-40)}` as Address;
}

function failedUserOperationMessage(receipt: TransactionReceipt): string | null {
  for (const log of receipt.logs) {
    if (log.topics[0] !== USER_OPERATION_EVENT_TOPIC) continue;
    const [nonce, success, , actualGasUsed] = decodeAbiParameters(
      [
        { type: "uint256" },
        { type: "bool" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      log.data,
    );
    if (success) continue;
    const sender = topicAddress(log.topics[2]);
    const details = [
      sender ? `sender ${sender}` : null,
      log.topics[1] ? `userOpHash ${log.topics[1]}` : null,
      `nonce ${nonce.toString()}`,
      `actualGasUsed ${actualGasUsed.toString()}`,
    ].filter(Boolean).join(", ");
    return `ERC-4337 user operation reverted (${details})`;
  }
  return null;
}

async function assertMinedTransactionSucceeded(
  transactionId: string,
  record: TransactionRecord,
): Promise<void> {
  const receipt = await minedReceipt(record);
  if (!receipt) return;
  if (receipt.status === "reverted") {
    throw new TransactionRevertError(transactionId, {
      ...record,
      status: "ERRORED",
      errorMessage: "Transaction receipt status is reverted",
    });
  }
  const userOpFailure = failedUserOperationMessage(receipt);
  if (userOpFailure) {
    throw new TransactionRevertError(transactionId, {
      ...record,
      status: "ERRORED",
      errorMessage: userOpFailure,
    });
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
    if (record.status === "MINED") {
      await assertMinedTransactionSucceeded(transactionId, record);
      return record;
    }
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
