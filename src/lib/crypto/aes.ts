// AES-256-GCM helper for custodial wallet secret keys.
//
// MVP-ONLY: The encryption key (WALLET_ENCRYPTION_KEY) sits in env. If compromised,
// every custodial wallet is compromised. Production must use a KMS or move custody
// to Turnkey/Privy/Magic. See lib/solana/wallet.ts.
//
// Format on disk:  base64( iv(12) || ciphertext || authTag(16) )

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) throw new Error("WALLET_ENCRYPTION_KEY missing");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must decode to 32 bytes (generate: openssl rand -base64 32)");
  }
  return buf;
}

export function encrypt(plaintext: Buffer): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decrypt(encoded: string): Buffer {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("Ciphertext too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
