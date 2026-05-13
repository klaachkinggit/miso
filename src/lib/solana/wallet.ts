// Custodial wallet management.
//
// MVP-ONLY:
// - Stores AES-256-GCM-encrypted Ed25519 secret keys in Supabase.
// - Encryption key (WALLET_ENCRYPTION_KEY) lives in env. Compromise = all wallets compromised.
// - Production must use a KMS / HSM, or move custody to Turnkey/Privy/Magic/Lit.
// - NEVER log secret keys. NEVER return them to the client.

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { encrypt } from "@/lib/crypto/aes";
import { createServiceClient } from "@/lib/supabase/service";

export interface CustodialWallet {
  address: string;
  secretBase58: string; // ephemeral — only used in-memory then discarded
}

/** Generate a new Ed25519 keypair. Returns base58 secret + pubkey. */
function generateKeypair(): CustodialWallet {
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
