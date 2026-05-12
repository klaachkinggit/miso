// Marketplace-side transfer for ticket NFTs.
//
// Tickets are minted with `PermanentFreezeDelegate { frozen: true }` so direct
// wallet-to-wallet transfers fail. Resale uses this guarded sequence:
//   1. Treasury thaws the asset (updatePluginV1 → frozen: false).
//   2. Custodial seller transfers the asset to the buyer.
//   3. Treasury refreezes the asset.
// Each step is a separate tx; the backend state machine keeps track so a
// crash between steps can be resumed by the reconciliation job.

import { createPlugin, fetchAsset, fetchCollection, transfer, updatePluginV1 } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { isDemoMode } from "@/lib/demo";
import { loadCustodialUmi } from "@/lib/solana/wallet";
import { treasuryUmi, buildUmi } from "./umi";

export interface MarketplaceTransferResult {
  thaw_signature: string;
  transfer_signature: string;
  refreeze_signature: string;
}

async function setFrozen(assetAddress: string, collectionAddress: string | null, frozen: boolean) {
  const umi = treasuryUmi();
  const asset = await fetchAsset(umi, publicKey(assetAddress));
  const collection = collectionAddress
    ? await fetchCollection(umi, publicKey(collectionAddress))
    : undefined;
  const tx = await updatePluginV1(umi, {
    asset: asset.publicKey,
    collection: collection ? collection.publicKey : undefined,
    plugin: createPlugin({ type: "PermanentFreezeDelegate", data: { frozen } }),
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
  return bs58.encode(tx.signature);
}

/**
 * Read the current frozen state of a ticket asset. Used by reconciliation.
 */
export async function isAssetFrozen(assetAddress: string): Promise<boolean> {
  if (isDemoMode()) return true;
  const umi = buildUmi();
  const asset = await fetchAsset(umi, publicKey(assetAddress));
  // mpl-core surfaces the plugin under asset.permanentFreezeDelegate (frozen).
  return Boolean(asset.permanentFreezeDelegate?.frozen);
}

export async function marketplaceTransfer(params: {
  assetAddress: string;
  collectionAddress: string | null;
  sellerUserId: string;
  buyerWallet: string;
}): Promise<MarketplaceTransferResult> {
  if (isDemoMode()) {
    const stamp = Date.now();
    return {
      thaw_signature: `demo_thaw_${stamp}`,
      transfer_signature: `demo_xfer_${stamp}`,
      refreeze_signature: `demo_refreeze_${stamp}`,
    };
  }

  // 1. Thaw (treasury authority).
  const thaw_signature = await setFrozen(params.assetAddress, params.collectionAddress, false);

  // 2. Transfer (seller signs).
  let transfer_signature = "";
  try {
    const sellerUmi = await loadCustodialUmi(params.sellerUserId);
    const asset = await fetchAsset(sellerUmi, publicKey(params.assetAddress));
    const collection = params.collectionAddress
      ? await fetchCollection(sellerUmi, publicKey(params.collectionAddress))
      : undefined;
    const tx = await transfer(sellerUmi, {
      asset,
      collection,
      newOwner: publicKey(params.buyerWallet),
    }).sendAndConfirm(sellerUmi);
    transfer_signature = bs58.encode(tx.signature);
  } catch (error) {
    // Best-effort refreeze on transfer failure so the ticket can't be moved
    // outside the marketplace while the asset is thawed.
    try { await setFrozen(params.assetAddress, params.collectionAddress, true); } catch { /* swallow */ }
    throw error;
  }

  // 3. Refreeze (treasury authority).
  const refreeze_signature = await setFrozen(params.assetAddress, params.collectionAddress, true);

  return { thaw_signature, transfer_signature, refreeze_signature };
}
