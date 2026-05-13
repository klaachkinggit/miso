// Thirdweb In-App Wallet pregenerate.
//
// Each user gets one wallet keyed on email. The EOA address holds nothing
// in this iteration; the smart account address is what owns NFTs on chain.
// Users never sign on chain — the backend wallet does that for them.

import { createServiceClient } from "@/lib/supabase/service";
import { thirdwebFetch } from "@/lib/thirdweb/client";

export interface UserWallet {
  evmAddress: string;
  smartAccountAddress: string;
}

interface PregenerateResponse {
  result?: {
    address?: string;
    smartAccountAddress?: string;
    smart_account_address?: string;
  };
  address?: string;
  smartAccountAddress?: string;
  smart_account_address?: string;
}

function getChainId(): number {
  const raw = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!raw) throw new Error("Missing CHAIN_ID env var");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid CHAIN_ID: ${raw}`);
  return parsed;
}

async function pregenerateWallet(email: string): Promise<UserWallet> {
  const response = await thirdwebFetch<PregenerateResponse>("/v1/wallets/user", {
    method: "POST",
    body: { strategy: "email", email, chainId: getChainId() },
    includeBackendWallet: false,
  });

  const result = response.result ?? response;
  const evmAddress = result.address;
  const smartAccountAddress =
    result.smartAccountAddress ?? result.smart_account_address;

  if (!evmAddress || !smartAccountAddress) {
    throw new Error(
      `Thirdweb pregenerate returned incomplete wallet for ${email}`,
    );
  }
  return { evmAddress, smartAccountAddress };
}

/**
 * Idempotent: returns the persisted wallet if it already exists, else
 * pregenerates one via Thirdweb and stores it. Service-role only.
 */
export async function ensureUserWallet(
  userId: string,
  email: string,
): Promise<UserWallet> {
  const sb = createServiceClient();

  const { data: existing } = await sb
    .from("wallets")
    .select("evm_address, smart_account_address")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (existing?.evm_address && existing.smart_account_address) {
    return {
      evmAddress: existing.evm_address,
      smartAccountAddress: existing.smart_account_address,
    };
  }

  const wallet = await pregenerateWallet(email);

  const { error } = await sb.from("wallets").insert({
    user_id: userId,
    evm_address: wallet.evmAddress,
    smart_account_address: wallet.smartAccountAddress,
    is_primary: true,
  });
  if (error) throw error;

  return wallet;
}
