// Thirdweb IPFS Storage wrapper (server-only).
//
// Uploads JSON metadata and raw file bytes via the api.thirdweb.com
// storage endpoint. Authenticated with the same `x-secret-key` used for
// the Transactions API. Returns canonical `ipfs://<cid>` URIs.

import { ThirdwebError } from "@/lib/thirdweb/client";

// IPFS upload lives on the legacy `storage.thirdweb.com` host, not
// api.thirdweb.com (which has no /v1/ipfs/upload route).
const STORAGE_BASE =
  process.env.THIRDWEB_STORAGE_URL ?? "https://storage.thirdweb.com";

interface IpfsUploadResponse {
  IpfsHash?: string;
  ipfsHash?: string;
  cid?: string;
  result?: { IpfsHash?: string; ipfsHash?: string; cid?: string };
}

function requireSecret(): string {
  const secret = process.env.THIRDWEB_SECRET_KEY;
  if (!secret) throw new Error("Missing THIRDWEB_SECRET_KEY env var");
  return secret;
}

function pickCid(res: IpfsUploadResponse): string {
  const cid =
    res.IpfsHash ??
    res.ipfsHash ??
    res.cid ??
    res.result?.IpfsHash ??
    res.result?.ipfsHash ??
    res.result?.cid;
  if (!cid) {
    throw new ThirdwebError(
      "Thirdweb IPFS upload returned no CID",
      0,
      res,
    );
  }
  return cid;
}

async function postMultipart(form: FormData): Promise<string> {
  const res = await fetch(`${STORAGE_BASE}/ipfs/upload`, {
    method: "POST",
    headers: {
      "x-secret-key": requireSecret(),
      accept: "application/json",
    },
    body: form,
    cache: "no-store",
  });

  const text = await res.text();
  const body = (text ? safeJson(text) : null) as IpfsUploadResponse | null;

  if (!res.ok) {
    throw new ThirdwebError(
      `Thirdweb IPFS upload failed: ${res.status}`,
      res.status,
      body ?? text,
    );
  }

  const cid = pickCid(body ?? {});
  return `ipfs://${cid}`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function uploadJson(value: unknown): Promise<string> {
  const form = new FormData();
  const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
  form.append("file", blob, "metadata.json");
  return postMultipart(form);
}

export async function uploadFile(args: {
  data: Blob | Uint8Array;
  mimeType: string;
  filename?: string;
}): Promise<string> {
  const form = new FormData();
  const blob =
    args.data instanceof Blob
      ? args.data
      : new Blob([args.data as BlobPart], { type: args.mimeType });
  form.append("file", blob, args.filename ?? "upload.bin");
  return postMultipart(form);
}
