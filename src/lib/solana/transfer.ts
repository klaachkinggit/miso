// Transfer a Core Asset (used by resale + refund).
// Custodial-only in MVP: the seller's keypair is loaded server-side.

import { transfer, fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { loadCustodialUmi } from "./wallet";

export async function transferAsset(params: {
  assetAddress: string;
  fromUserId: string; // current custodial owner
  toWalletAddress: string;
}): Promise<{ signature: string }> {
  const umi = await loadCustodialUmi(params.fromUserId);
  const asset = await fetchAsset(umi, publicKey(params.assetAddress));
  const collection = asset.updateAuthority.type === "Collection"
    ? await import("@metaplex-foundation/mpl-core").then((m) =>
        m.fetchCollection(umi, asset.updateAuthority.address!)
      )
    : undefined;

  const tx = await transfer(umi, {
    asset,
    collection,
    newOwner: publicKey(params.toWalletAddress),
  }).sendAndConfirm(umi);

  return { signature: Buffer.from(tx.signature).toString("base64") };
}
