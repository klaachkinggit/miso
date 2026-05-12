// Mint a Metaplex Core Asset (ticket NFT) into an event collection.
//
// Tickets are minted **non-transferable by default** via the
// `PermanentFreezeDelegate` plugin with `frozen: true`. The plugin authority
// defaults to the collection update authority (treasury), so only the treasury
// can unfreeze. Direct wallet-to-wallet transfers fail; the marketplace flow
// briefly unfreezes for resale and re-freezes after the transfer.

import { create, fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import { treasuryUmi } from "./umi";

export interface MintParams {
  collectionAddress: string;
  buyerWallet: string;
  name: string;
  metadataUri: string;
  attributes: { key: string; value: string }[];
}

export interface MintResult {
  assetAddress: string;
  signature: string;
}

export async function mintTicketNft(params: MintParams): Promise<MintResult> {
  const umi = treasuryUmi();
  const collection = await fetchCollection(umi, publicKey(params.collectionAddress));
  const asset = generateSigner(umi);

  const tx = await create(umi, {
    asset,
    collection,
    name: params.name,
    uri: params.metadataUri,
    owner: publicKey(params.buyerWallet),
    plugins: [
      {
        type: "Attributes",
        attributeList: params.attributes.map((a) => ({ key: a.key, value: a.value })),
      },
      {
        // Ticket non-transferable by default. Authority defaults to the
        // collection update authority (treasury), so the marketplace flow can
        // thaw → transfer → refreeze.
        type: "PermanentFreezeDelegate",
        frozen: true,
      },
    ],
  }).sendAndConfirm(umi);

  return {
    assetAddress: asset.publicKey.toString(),
    signature: Buffer.from(tx.signature).toString("base64"),
  };
}
