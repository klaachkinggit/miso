// Upload NFT metadata JSON to Supabase Storage (public bucket).
// TODO V2: move to IPFS/Arweave for permanence (Bundlr/Irys is also fine).

import { createServiceClient } from "@/lib/supabase/service";

export interface TicketMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: { trait_type: string; value: string | number }[];
  properties?: Record<string, unknown>;
}

const BUCKET = "nft-metadata";

export async function uploadMetadata(path: string, metadata: TicketMetadata): Promise<string> {
  const sb = createServiceClient();
  const body = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
  const { error } = await sb.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
