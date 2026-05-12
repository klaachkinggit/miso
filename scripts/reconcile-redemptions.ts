// Reconciliation job — chain ↔ DB repair for redemptions.
//
// Two drift cases to fix:
//
//   1. The customer's redeem tx confirmed and the treasury wrote `used=true`
//      on-chain, but the backend crashed before flipping the DB row. Without
//      repair the ticket stays `sold` and the customer is locked out of any
//      retry.
//
//   2. The DB shows a successful redemption but a previous run failed to
//      write the on-chain attribute (e.g. RPC outage). Re-running the
//      attribute write is idempotent and restores parity.
//
// Run via `pnpm tsx scripts/reconcile-redemptions.ts` from a cron or operator
// console. Service-role only.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { buildUmi } from "../src/lib/solana/umi";
import { deriveRedemptionPda, writeOnchainRedemptionAttribute } from "../src/lib/solana/redeem-tx";
import type { Ticket, TicketRedemption } from "../src/types/db";

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readOnchainUsed(assetAddress: string): Promise<boolean> {
  const umi = buildUmi();
  const asset = await fetchAsset(umi, publicKey(assetAddress));
  const list = asset.attributes?.attributeList ?? [];
  return list.some((a) => a.key === "used" && a.value === "true");
}

async function repairDrift() {
  const sb = svc();
  let fixed = 0;

  // Case 1: ticket says sold but chain says used → flip DB.
  const { data: maybeUsed } = await sb
    .from("tickets")
    .select("*")
    .eq("status", "sold")
    .not("nft_asset_address", "is", null)
    .limit(200)
    .returns<Ticket[]>();

  for (const ticket of maybeUsed ?? []) {
    if (!ticket.nft_asset_address) continue;
    let onchainUsed = false;
    try { onchainUsed = await readOnchainUsed(ticket.nft_asset_address); }
    catch { continue; }
    if (!onchainUsed) continue;

    const redemption_pda = deriveRedemptionPda(ticket.event_id, ticket.nft_asset_address);
    const { data: prior } = await sb
      .from("ticket_redemptions")
      .select("*")
      .eq("ticket_id", ticket.id)
      .eq("result", "valid")
      .maybeSingle<TicketRedemption>();

    const { error: flipErr } = await sb
      .from("tickets")
      .update({
        status: "used",
        used_at: prior?.redeemed_at ?? new Date().toISOString(),
        redeem_tx_signature: prior?.redeem_tx_signature ?? null,
        redemption_pda: prior?.redemption_pda ?? redemption_pda,
        redeemed_wallet_address: prior?.wallet_address ?? null,
      })
      .eq("id", ticket.id)
      .eq("status", "sold");
    if (!flipErr) {
      fixed++;
      console.log(`Reconciled ticket ${ticket.id} (chain used → DB used)`);
    }
  }

  // Case 2: redemption row says valid but chain not flipped → re-apply attribute.
  const { data: validRows } = await sb
    .from("ticket_redemptions")
    .select("*")
    .eq("result", "valid")
    .not("redeem_tx_signature", "is", null)
    .order("redeemed_at", { ascending: false })
    .limit(200)
    .returns<TicketRedemption[]>();

  for (const row of validRows ?? []) {
    const { data: ticket } = await sb
      .from("tickets")
      .select("*")
      .eq("id", row.ticket_id)
      .single<Ticket>();
    if (!ticket?.nft_asset_address) continue;
    let onchainUsed = false;
    try { onchainUsed = await readOnchainUsed(ticket.nft_asset_address); }
    catch { continue; }
    if (onchainUsed) continue;

    const { data: event } = await sb
      .from("events")
      .select("solana_collection_address")
      .eq("id", ticket.event_id)
      .single<{ solana_collection_address: string | null }>();

    try {
      await writeOnchainRedemptionAttribute({
        assetAddress: ticket.nft_asset_address,
        collectionAddress: event?.solana_collection_address ?? null,
        nonce: row.redeem_tx_signature ?? "reconcile",
        txSignature: row.redeem_tx_signature ?? "",
      });
      fixed++;
      console.log(`Reconciled ticket ${ticket.id} (DB valid → chain used)`);
    } catch (error) {
      console.error(`Failed to reapply attribute for ${ticket.id}`, error);
    }
  }

  return fixed;
}

async function main() {
  const fixed = await repairDrift();
  console.log(`Reconciliation complete: ${fixed} rows repaired.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
