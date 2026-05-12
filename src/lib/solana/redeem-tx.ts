// Build, sign, and confirm customer-side redemption transactions.
//
// Path B (mpl-core, no custom program):
//   Step 1 (customer): a Solana transaction with a single SPL Memo instruction
//                      containing the redemption payload (ticket, event, gate,
//                      nonce). Signed by the on-chain NFT owner — this is the
//                      proof of ownership. Custodial backend signs server-side;
//                      external wallets sign via wallet adapter.
//   Step 2 (treasury): after the customer tx confirms, the treasury submits an
//                      `updatePluginV1` to write `used=true` to the asset's
//                      Attributes plugin. This is the on-chain proof of
//                      redemption visible to other dapps.
//
// In demo mode (no real NFT), step 1 and step 2 are both no-ops and we return
// synthetic signatures so the redemption pipeline still flips the DB.

import { createHash, randomBytes } from "node:crypto";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createPlugin, fetchAsset, fetchCollection, updatePluginV1 } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { Keypair } from "@solana/web3.js";
import { isDemoMode } from "@/lib/demo";
import { decrypt } from "@/lib/crypto/aes";
import { createServiceClient } from "@/lib/supabase/service";
import { treasuryUmi } from "./umi";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface RedeemMemoPayload {
  type: "miso.redeem";
  ticket: string;
  event: string;
  gate: string;       // gate_session_id
  nonce: string;      // hex
  asset: string;      // mpl-core asset address
  version: 1;
}

export interface PreparedRedeemTx {
  /** Base64 serialized (unsigned) tx; client signs and submits this. */
  serialized_tx_b64: string;
  /** Memo payload that was embedded. */
  payload: RedeemMemoPayload;
  /** Synthetic deterministic redemption_pda (sha256). */
  redemption_pda: string;
  /** Recent blockhash used. */
  recent_blockhash: string;
  /** Required signer wallet (asset owner). */
  signer_wallet: string;
}

export interface CustodialSignedRedeemTx extends PreparedRedeemTx {
  tx_signature: string;
  signed: true;
}

const rpc = () => process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export function deriveRedemptionPda(eventId: string, assetAddress: string): string {
  return createHash("sha256")
    .update(`${eventId}|${assetAddress}|miso.redeem.v1`)
    .digest("hex");
}

export function newNonce(): string {
  return randomBytes(12).toString("hex");
}

function buildMemoInstruction(payload: RedeemMemoPayload, payer: PublicKey): TransactionInstruction {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  return new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data,
  });
}

/**
 * Build (and for custodial signers, sign + submit) the customer redemption tx.
 * Returns the prepared/signed payload.
 */
export async function buildRedeemTx(params: {
  ticketId: string;
  eventId: string;
  gateSessionId: string;
  assetAddress: string;
  signerWallet: string;
  walletType: "custodial" | "external";
  custodialUserId?: string;
}): Promise<PreparedRedeemTx | CustodialSignedRedeemTx> {
  const nonce = newNonce();
  const payload: RedeemMemoPayload = {
    type: "miso.redeem",
    ticket: params.ticketId,
    event: params.eventId,
    gate: params.gateSessionId,
    nonce,
    asset: params.assetAddress,
    version: 1,
  };

  if (isDemoMode()) {
    const fake = `demo_redeem_${Date.now()}_${nonce.slice(0, 8)}`;
    return {
      serialized_tx_b64: "",
      payload,
      redemption_pda: deriveRedemptionPda(params.eventId, params.assetAddress),
      recent_blockhash: "demo",
      signer_wallet: params.signerWallet,
      tx_signature: fake,
      signed: true,
    } as CustodialSignedRedeemTx;
  }

  const conn = new Connection(rpc(), "confirmed");
  const payer = new PublicKey(params.signerWallet);
  const tx = new Transaction();
  tx.add(buildMemoInstruction(payload, payer));
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  const redemption_pda = deriveRedemptionPda(params.eventId, params.assetAddress);

  if (params.walletType === "custodial") {
    if (!params.custodialUserId) throw new Error("custodialUserId required");
    const sb = createServiceClient();
    const { data: row, error } = await sb
      .from("wallets")
      .select("encrypted_secret_key, wallet_type")
      .eq("user_id", params.custodialUserId)
      .eq("is_primary", true)
      .single();
    if (error) throw error;
    if (row.wallet_type !== "custodial" || !row.encrypted_secret_key) {
      throw new Error("User is not custodial");
    }
    const secret = decrypt(row.encrypted_secret_key);
    const kp = Keypair.fromSecretKey(new Uint8Array(secret));
    tx.sign(kp);
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight: (await conn.getLatestBlockhash()).lastValidBlockHeight },
      "confirmed"
    );
    return {
      serialized_tx_b64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      payload,
      redemption_pda,
      recent_blockhash: blockhash,
      signer_wallet: params.signerWallet,
      tx_signature: sig,
      signed: true,
    };
  }

  // External wallet: client signs + submits. Return unsigned bytes.
  const serialized = tx.serialize({ requireAllSignatures: false });
  return {
    serialized_tx_b64: Buffer.from(serialized).toString("base64"),
    payload,
    redemption_pda,
    recent_blockhash: blockhash,
    signer_wallet: params.signerWallet,
  };
}

/**
 * Verify a confirmed customer redemption tx:
 *  - tx exists + finalized/confirmed,
 *  - tx fee payer / signer == declared signer_wallet,
 *  - tx contains a Memo with the expected payload,
 *  - signer_wallet matches the current on-chain asset owner.
 */
export async function verifyRedeemTx(params: {
  txSignature: string;
  expectedPayload: RedeemMemoPayload;
  expectedSigner: string;
  assetAddress: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isDemoMode() || params.txSignature.startsWith("demo_redeem_")) return { ok: true };

  const conn = new Connection(rpc(), "confirmed");
  const tx = await conn.getParsedTransaction(params.txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return { ok: false, reason: "Transaction not found on chain" };
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on chain" };

  const accountKeys = tx.transaction.message.accountKeys;
  const feePayer = accountKeys.find((k) => k.signer)?.pubkey.toBase58()
    ?? accountKeys[0]?.pubkey.toBase58();
  if (feePayer !== params.expectedSigner) {
    return { ok: false, reason: `Signer mismatch: ${feePayer} vs ${params.expectedSigner}` };
  }

  // Find memo instruction by program id.
  const memoProgramId = MEMO_PROGRAM_ID.toBase58();
  let memoData: string | null = null;
  for (const ix of tx.transaction.message.instructions) {
    if (ix.programId.toBase58() !== memoProgramId) continue;
    // ParsedInstruction has `parsed`, PartiallyDecodedInstruction has `data` (base58).
    if ("parsed" in ix && typeof ix.parsed === "string") {
      memoData = ix.parsed;
    } else if ("data" in ix) {
      memoData = Buffer.from(bs58.decode(ix.data)).toString("utf8");
    }
    break;
  }
  if (!memoData) return { ok: false, reason: "Memo instruction missing data" };

  let parsed: RedeemMemoPayload;
  try { parsed = JSON.parse(memoData); }
  catch { return { ok: false, reason: "Memo not JSON" }; }
  if (
    parsed.type !== "miso.redeem" ||
    parsed.ticket !== params.expectedPayload.ticket ||
    parsed.event !== params.expectedPayload.event ||
    parsed.gate !== params.expectedPayload.gate ||
    parsed.asset !== params.expectedPayload.asset ||
    parsed.nonce !== params.expectedPayload.nonce
  ) {
    return { ok: false, reason: "Memo payload mismatch" };
  }

  // On-chain owner check.
  const umi = treasuryUmi();
  const asset = await fetchAsset(umi, publicKey(params.assetAddress));
  if (asset.owner.toString() !== params.expectedSigner) {
    return { ok: false, reason: "Signer is not current NFT owner" };
  }
  return { ok: true };
}

/**
 * Treasury writes used=true to the asset's Attributes plugin (on-chain proof
 * of redemption). Idempotent — re-running is safe.
 */
export async function writeOnchainRedemptionAttribute(params: {
  assetAddress: string;
  collectionAddress: string | null;
  nonce: string;
  txSignature: string;
}): Promise<{ signature: string }> {
  if (isDemoMode()) return { signature: `demo_attr_${Date.now()}` };

  const umi = treasuryUmi();
  const asset = await fetchAsset(umi, publicKey(params.assetAddress));
  const collection = params.collectionAddress
    ? await fetchCollection(umi, publicKey(params.collectionAddress))
    : undefined;

  const existing = asset.attributes?.attributeList ?? [];
  const filtered = existing.filter(
    (a) => a.key !== "used" && a.key !== "redeemed_at" && a.key !== "redeem_sig"
  );
  const attributeList = [
    ...filtered,
    { key: "used", value: "true" },
    { key: "redeemed_at", value: new Date().toISOString() },
    { key: "redeem_sig", value: params.txSignature.slice(0, 64) },
  ];

  const tx = await updatePluginV1(umi, {
    asset: asset.publicKey,
    collection: collection ? collection.publicKey : undefined,
    plugin: createPlugin({ type: "Attributes", data: { attributeList } }),
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  return { signature: bs58.encode(tx.signature) };
}

