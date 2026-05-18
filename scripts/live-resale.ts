// Drives on-chain resale against Base Sepolia:
//   1. Reuse already-deployed event contract (run live-flow.ts first).
//   2. Mint a fresh ticket to buyer (sold).
//   3. Buyer lists it. Seller transfer is fulfilled on-chain.
//   4. Print tx hash.
//
// Resale checkout now requires a Stripe Checkout Session. This script bypasses
// the hosted payment step and drives only the seeded ticket plus chain transfer
// portion of the resale flow.
//
// Pre-req: `npm run demo:seed` + `npx tsx scripts/live-flow.ts` already ran
// (event contract is deployed).

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createServiceClient } from "@/lib/supabase/service";
import {
  reserveTicket,
  fulfillReservedTicket,
} from "@/lib/tickets/lifecycle";
import {
  createResaleListing,
  fulfillResale,
} from "@/lib/resale/listing";
import type { EventRow, TicketCategory } from "@/types/db";

async function main() {
  const sb = createServiceClient();

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, email")
    .in("email", ["buyer@miso.local", "seller@miso.local"]);
  const byEmail = Object.fromEntries((profiles ?? []).map((p) => [p.email, p.id]));
  const buyerId = byEmail["buyer@miso.local"];
  const sellerId = byEmail["seller@miso.local"];

  const { data: event } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<EventRow>();
  if (!event?.nft_contract_address) {
    throw new Error("Run live-flow.ts first — no deployed contract on event");
  }
  console.log(`event ${event.id} contract=${event.nft_contract_address}`);

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("event_id", event.id)
    .limit(1)
    .single<TicketCategory>();
  if (!category) throw new Error("No category");

  console.log("→ reserve + mint a fresh ticket for buyer…");
  const { ticket } = await reserveTicket({
    categoryId: category.id,
    buyerUserId: buyerId,
  });

  const { data: purchase } = await sb
    .from("purchases")
    .insert({
      buyer_user_id: buyerId,
      event_id: event.id,
      ticket_id: ticket.id,
      amount: category.price,
      currency: category.currency,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: "live-resale-script",
    })
    .select("id")
    .single<{ id: string }>();
  if (!purchase) throw new Error("purchase insert failed");

  const fulfilled = await fulfillReservedTicket({
    ticketId: ticket.id,
    buyerUserId: buyerId,
    purchaseId: purchase.id,
  });
  console.log(`   minted tokenId=${fulfilled.tokenId} tx=${fulfilled.mintTxHash}`);

  console.log("→ buyer lists ticket for resale…");
  const listing = await createResaleListing({
    ticketId: ticket.id,
    sellerUserId: buyerId,
    price: Number(category.price),
  });
  console.log(`   listing ${listing.id} @ ${listing.price} ${listing.currency}`);

  console.log("→ seller buys → adminTransfer on chain…");
  await fulfillResale({ listingId: listing.id, buyerUserId: sellerId });

  const { data: after } = await sb
    .from("tickets")
    .select("owner_user_id, owner_evm_address, last_transfer_tx_hash, status")
    .eq("id", ticket.id)
    .single<{
      owner_user_id: string;
      owner_evm_address: string;
      last_transfer_tx_hash: string;
      status: string;
    }>();

  console.log("\n✓ resale flow complete");
  console.log(`  new owner_user_id: ${after?.owner_user_id} (seller=${sellerId})`);
  console.log(`  new evm owner:     ${after?.owner_evm_address}`);
  console.log(`  transfer tx:       ${after?.last_transfer_tx_hash}`);
  console.log(`  status:            ${after?.status}`);
  if (after?.last_transfer_tx_hash) {
    console.log(`  basescan: https://sepolia.basescan.org/tx/${after.last_transfer_tx_hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
