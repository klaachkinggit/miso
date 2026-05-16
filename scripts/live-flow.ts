// Drives a real on-chain end-to-end flow against Base Sepolia:
//   1. publishEventSetup → deploys MisoTicket per event
//   2. reserveTicket + fulfillReservedTicket → mints ERC-721 to buyer
//   3. confirmRedemption (via gate session) → setAttribute(Redeemed=true)
//
// Uses service-role Supabase. Bypasses HTTP auth. Run after `npm run demo:seed`.

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createServiceClient } from "@/lib/supabase/service";
import { publishEventSetup } from "@/lib/events/setup";
import { reserveTicket, fulfillReservedTicket } from "@/lib/tickets/lifecycle";
import { openGateForController } from "@/lib/gates/operations";
import { confirmRedemption } from "@/lib/verification/redeem";
import type { EventRow, Ticket, TicketCategory } from "@/types/db";

async function main() {
  const sb = createServiceClient();

  const { data: profiles, error: profErr } = await sb
    .from("profiles")
    .select("id, email, role")
    .in("email", [
      "admin@miso.local",
      "buyer@miso.local",
      "controller@miso.local",
    ]);
  if (profErr) throw profErr;
  const byEmail = Object.fromEntries(
    (profiles ?? []).map((p) => [p.email, p.id]),
  );
  const adminId = byEmail["admin@miso.local"];
  const buyerId = byEmail["buyer@miso.local"];
  const controllerId = byEmail["controller@miso.local"];
  if (!adminId || !buyerId || !controllerId) {
    throw new Error("Missing seeded users — run `npm run demo:seed` first");
  }

  const { data: event } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<EventRow>();
  if (!event) throw new Error("No seeded event found");
  console.log(`event ${event.id} — "${event.name}"`);

  console.log("→ publish (deploys MisoTicket on chain if needed)…");
  await publishEventSetup({ eventId: event.id, adminUserId: adminId });
  const { data: published } = await sb
    .from("events")
    .select("nft_contract_address")
    .eq("id", event.id)
    .single<Pick<EventRow, "nft_contract_address">>();
  console.log(`   contract: ${published?.nft_contract_address}`);

  const { data: category } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("event_id", event.id)
    .limit(1)
    .single<TicketCategory>();
  if (!category) throw new Error("No category");
  console.log(`category ${category.id} (${category.name})`);

  console.log("→ reserve ticket…");
  const { ticket } = await reserveTicket({
    categoryId: category.id,
    buyerUserId: buyerId,
  });
  console.log(`   reserved ticket ${ticket.id} serial=${ticket.serial_number}`);

  const { data: purchase, error: purchaseErr } = await sb
    .from("purchases")
    .insert({
      buyer_user_id: buyerId,
      event_id: event.id,
      ticket_id: ticket.id,
      amount: category.price,
      currency: category.currency,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: "live-flow-script",
    })
    .select("id")
    .single<{ id: string }>();
  if (purchaseErr || !purchase) throw purchaseErr ?? new Error("purchase insert failed");
  console.log(`   purchase ${purchase.id}`);

  console.log("→ fulfill (mints ERC-721 on chain)…");
  const fulfilled = await fulfillReservedTicket({
    ticketId: ticket.id,
    buyerUserId: buyerId,
    purchaseId: purchase.id,
  });
  console.log(`   minted tokenId=${fulfilled.tokenId}`);
  console.log(`   mint tx: ${fulfilled.mintTxHash}`);
  console.log(`   owner: ${fulfilled.ownerEvmAddress}`);

  console.log("→ open gate session…");
  const gate = await openGateForController({
    eventId: event.id,
    profile: { id: controllerId, role: "controller" },
    gateName: "Live Test Gate",
  });
  console.log(`   gate ${gate.short_code}`);

  console.log("→ confirm redemption (writes Redeemed=true on chain)…");
  const outcome = await confirmRedemption({
    userId: buyerId,
    gateShortCode: gate.short_code,
    ticketId: (ticket as Ticket).id,
  });
  console.log(`   result: ${outcome.result}`);
  console.log(`   attr tx: ${outcome.attr_tx_signature ?? "(none)"}`);

  console.log("\n✓ live flow complete");
  console.log(`  contract: https://sepolia.basescan.org/address/${published?.nft_contract_address}`);
  console.log(`  mint tx:  https://sepolia.basescan.org/tx/${fulfilled.mintTxHash}`);
  if (outcome.attr_tx_signature) {
    console.log(`  redeem tx: https://sepolia.basescan.org/tx/${outcome.attr_tx_signature}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
