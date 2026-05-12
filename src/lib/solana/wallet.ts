// Custodial wallet management.
//
// MVP-ONLY:
// - Stores AES-256-GCM-encrypted Ed25519 secret keys in Supabase.
// - Encryption key (WALLET_ENCRYPTION_KEY) lives in env. Compromise = all wallets compromised.
// - Production must use a KMS / HSM, or move custody to Turnkey/Privy/Magic/Lit.
// - NEVER log secret keys. NEVER return them to the client.

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { encrypt, decrypt } from "@/lib/crypto/aes";
import { createServiceClient } from "@/lib/supabase/service";
import { umiFromSecret } from "@/lib/solana/umi";
import type { Umi } from "@metaplex-foundation/umi";

export interface CustodialWallet {
  address: string;
  secretBase58: string; // ephemeral — only used in-memory then discarded
}

/** Generate a new Ed25519 keypair. Returns base58 secret + pubkey. */
export function generateKeypair(): CustodialWallet {
  const kp = Keypair.generate();
  return { address: kp.publicKey.toBase58(), secretBase58: bs58.encode(kp.secretKey) };
}

/**
 * Create + persist a custodial wallet for a user. Idempotent: returns existing if found.
 * Service-role only.
 */
export async function ensureCustodialWallet(userId: string): Promise<{ address: string }> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("wallets")
    .select("wallet_address")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  if (existing) return { address: existing.wallet_address };

  const wallet = generateKeypair();
  const encrypted = encrypt(Buffer.from(bs58.decode(wallet.secretBase58)));

  const { error } = await sb.from("wallets").insert({
    user_id: userId,
    wallet_address: wallet.address,
    encrypted_secret_key: encrypted,
    wallet_type: "custodial",
    is_primary: true,
  });
  if (error) throw error;

  return { address: wallet.address };
}

/**
 * Load a custodial Umi signer for a user. SERVICE ROLE ONLY.
 * Throws if user has no custodial wallet or is external-only.
 */
export async function loadCustodialUmi(userId: string): Promise<Umi> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("wallets")
    .select("encrypted_secret_key, wallet_type")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .single();
  if (error) throw error;
  if (data.wallet_type !== "custodial" || !data.encrypted_secret_key) {
    throw new Error("User has no custodial wallet (external-only)");
  }
  const secret = decrypt(data.encrypted_secret_key);
  return umiFromSecret(new Uint8Array(secret));
}

/** Sign arbitrary bytes with a user's custodial keypair. */
export async function signWithCustodial(userId: string, message: Uint8Array): Promise<{
  signature: string;
  publicKey: string;
}> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("wallets")
    .select("encrypted_secret_key, wallet_address, wallet_type")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .single();
  if (error) throw error;
  if (data.wallet_type !== "custodial" || !data.encrypted_secret_key) {
    throw new Error("Cannot server-sign for an external wallet");
  }
  const secret = decrypt(data.encrypted_secret_key);
  const kp = Keypair.fromSecretKey(new Uint8Array(secret));
  const nacl = await import("tweetnacl");
  const sig = nacl.sign.detached(message, kp.secretKey);
  return { signature: bs58.encode(sig), publicKey: data.wallet_address };
}
