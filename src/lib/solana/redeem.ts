// On-chain ticket redemption.
//
// The treasury (collection update authority) updates the ticket asset's
// Attributes plugin to record the redemption — this is the on-chain proof that
// the ticket has been consumed. The DB flip to `used` only happens after this
// transaction is confirmed; on any failure the ticket remains valid + reusable.
//
// In demo mode (no real NFT minted) this is a no-op that returns a fake sig so
// the verify pipeline can still flip the DB.

import { createPlugin, fetchAsset, fetchCollection, updatePluginV1 } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { isDemoMode } from "@/lib/demo";
import { treasuryUmi } from "./umi";

export interface RedeemResult {
  signature: string;
  demo: boolean;
}

export async function redeemTicketOnchain(params: {
  assetAddress: string | null;
  collectionAddress: string | null;
}): Promise<RedeemResult> {
  if (isDemoMode() || !params.assetAddress) {
    return { signature: `demo_redeem_${Date.now()}`, demo: true };
  }

  const umi = treasuryUmi();
  const asset = await fetchAsset(umi, publicKey(params.assetAddress));
  const collection =
    params.collectionAddress
      ? await fetchCollection(umi, publicKey(params.collectionAddress))
      : undefined;

  // Reuse existing attribute list and append redemption markers. Idempotent on
  // the on-chain side; if the asset is already marked used we still want a
  // signed tx to confirm but won't accidentally double-flip downstream because
  // the DB write is guarded by the `status='sold'` predicate.
  const existing = asset.attributes?.attributeList ?? [];
  const filtered = existing.filter((a) => a.key !== "used" && a.key !== "redeemed_at");
  const attributeList = [
    ...filtered,
    { key: "used", value: "true" },
    { key: "redeemed_at", value: new Date().toISOString() },
  ];

  const tx = await updatePluginV1(umi, {
    asset: asset.publicKey,
    collection: collection ? collection.publicKey : undefined,
    plugin: createPlugin({ type: "Attributes", data: { attributeList } }),
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  return {
    signature: Buffer.from(tx.signature).toString("base64"),
    demo: false,
  };
}
