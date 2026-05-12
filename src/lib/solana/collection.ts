// Create one Metaplex Core collection per event. Called on event publish.

import { createCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner } from "@metaplex-foundation/umi";
import { treasuryUmi } from "./umi";

export interface CollectionResult {
  address: string;
  signature: string;
}

export async function createEventCollection(params: {
  eventName: string;
  metadataUri: string;
}): Promise<CollectionResult> {
  const umi = treasuryUmi();
  const collection = generateSigner(umi);
  const tx = await createCollection(umi, {
    collection,
    name: params.eventName,
    uri: params.metadataUri,
  }).sendAndConfirm(umi);
  return {
    address: collection.publicKey.toString(),
    signature: Buffer.from(tx.signature).toString("base64"),
  };
}
