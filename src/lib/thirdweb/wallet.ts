// Thirdweb In-App Wallet pregenerate.
//
// Each user gets one EOA wallet keyed on email. Tickets are minted to and
// owned by that EOA directly — we are explicitly NOT using ERC-4337
// account abstraction in this iteration (plan: "no paymaster, no smart
// account UserOp"). The backend wallet still signs every on-chain
// operation on behalf of users via its admin roles.
//
// The `wallets.smart_account_address` column is preserved for forward
// compatibility but mirrors `evm_address` until AA is enabled.

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
  };
  address?: string;
  smartAccountAddress?: string;
}

async function pregenerateWallet(email: string): Promise<UserWallet> {
  const response = await thirdwebFetch<PregenerateResponse>("/v1/wallets/user", {
    method: "POST",
    body: { type: "email", email },
  });

  const result = response.result ?? response;
  const evmAddress = result.address;
  if (!evmAddress) {
    throw new Error(
      `Thirdweb pregenerate returned no address for ${email}`,
    );
  }
  return {
    evmAddress,
    smartAccountAddress: result.smartAccountAddress ?? evmAddress,
  };
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

  if (existing?.evm_address) {
    return {
      evmAddress: existing.evm_address,
      smartAccountAddress:
        existing.smart_account_address ?? existing.evm_address,
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
