import { createHash, randomBytes } from "node:crypto";

export interface DemoRedeemPayload {
  type: "miso.redeem";
  ticket: string;
  event: string;
  gate: string;
  nonce: string;
  asset: string;
  version: 1;
}

export interface PreparedDemoRedeem {
  serialized_tx_b64: string;
  payload: DemoRedeemPayload;
  redemption_pda: string;
  recent_blockhash: string;
  signer_wallet: string;
}

export interface SignedDemoRedeem extends PreparedDemoRedeem {
  tx_signature: string;
  signed: true;
}

export interface DemoMarketplaceTransferResult {
  thaw_signature: string;
  transfer_signature: string;
  refreeze_signature: string;
}

export function demoCollectionAddress(eventId: string): string {
  return `demo_collection_${eventId}`;
}

export function demoTicketAssetAddress(ticketId: string): string {
  return `demo_asset_${ticketId}`;
}

export function demoTicketMetadataUri(ticketId: string): string {
  return `demo://ticket/${ticketId}`;
}

export function demoRedemptionPda(eventId: string, assetAddress: string): string {
  return createHash("sha256")
    .update(`${eventId}|${assetAddress}|miso.redeem.v1`)
    .digest("hex");
}

export function demoTicketAssetAddressFor(ticket: { id: string; nft_asset_address: string | null }): string {
  return ticket.nft_asset_address ?? demoTicketAssetAddress(ticket.id);
}

export async function prepareDemoRedeem(params: {
  ticketId: string;
  eventId: string;
  gateSessionId: string;
  assetAddress: string;
  signerWallet: string;
}): Promise<SignedDemoRedeem> {
  const nonce = randomBytes(12).toString("hex");
  const payload: DemoRedeemPayload = {
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
    redemption_pda: demoRedemptionPda(params.eventId, params.assetAddress),
    recent_blockhash: "demo",
    signer_wallet: params.signerWallet,
    tx_signature: `demo_redeem_${Date.now()}_${nonce.slice(0, 8)}`,
    signed: true,
  };
}

export async function verifyDemoRedeem(): Promise<{ ok: true }> {
  return { ok: true };
}

export async function writeDemoRedemptionAttribute(): Promise<{ signature: string }> {
  return { signature: `demo_attr_${Date.now()}` };
}

export async function demoMarketplaceTransfer(): Promise<DemoMarketplaceTransferResult> {
  const stamp = Date.now();
  return {
    thaw_signature: `demo_thaw_${stamp}`,
    transfer_signature: `demo_xfer_${stamp}`,
    refreeze_signature: `demo_refreeze_${stamp}`,
  };
}
