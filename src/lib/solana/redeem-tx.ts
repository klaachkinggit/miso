// Demo redemption pipeline. No real Solana memo tx, no on-chain attribute
// write — synthetic signatures are returned so the downstream DB flip in
// confirmRedemption can still record the redemption.

import { createHash, randomBytes } from "node:crypto";

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
  /** Base64 serialized (unsigned) tx; unused in demo, kept for shape parity. */
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

export function deriveRedemptionPda(eventId: string, assetAddress: string): string {
  return createHash("sha256")
    .update(`${eventId}|${assetAddress}|miso.redeem.v1`)
    .digest("hex");
}

export function newNonce(): string {
  return randomBytes(12).toString("hex");
}

export async function buildRedeemTx(params: {
  ticketId: string;
  eventId: string;
  gateSessionId: string;
  assetAddress: string;
  signerWallet: string;
}): Promise<CustodialSignedRedeemTx> {
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
  return {
    serialized_tx_b64: "",
    payload,
    redemption_pda: deriveRedemptionPda(params.eventId, params.assetAddress),
    recent_blockhash: "demo",
    signer_wallet: params.signerWallet,
    tx_signature: `demo_redeem_${Date.now()}_${nonce.slice(0, 8)}`,
    signed: true,
  };
}

export async function verifyRedeemTx(): Promise<{ ok: true }> {
  return { ok: true };
}

export async function writeOnchainRedemptionAttribute(): Promise<{ signature: string }> {
  return { signature: `demo_attr_${Date.now()}` };
}
