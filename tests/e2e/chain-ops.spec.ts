// chain_ops invariants. No chain calls — uses raw Supabase to assert the
// migration-level guarantees that prevent the bugs called out in
// docs/audit/on-chain-risks.md.
//
// Run with: MISO_E2E_INVARIANTS=1 npx playwright test tests/e2e/chain-ops.spec.ts

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getProfileIdByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single<{ id: string }>();
  if (!data) throw new Error(`Missing seeded profile ${email}`);
  return data.id;
}

async function seedTicket(
  client: SupabaseClient,
  buyerId: string,
): Promise<{ ticketId: string; eventId: string; categoryId: string; purchaseId: string }> {
  const { data: event } = await client
    .from("events")
    .insert({
      name: `ChainOps Fixture ${Date.now()}-${Math.random()}`,
      date: new Date(Date.now() + 86_400_000).toISOString(),
      venue_name: "T",
      city: "T",
      capacity: 5,
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: false,
      status: "published",
      nft_contract_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
      role_admin_address: "0xroleadmin",
    })
    .select("id")
    .single<{ id: string }>();
  const { data: cat } = await client
    .from("ticket_categories")
    .insert({
      event_id: event!.id,
      name: "GA",
      price: 100,
      currency: "MAD",
      supply: 1,
      resale_enabled: true,
    })
    .select("id")
    .single<{ id: string }>();
  const { data: ticket } = await client
    .from("tickets")
    .insert({
      event_id: event!.id,
      category_id: cat!.id,
      serial_number: 1,
      status: "reserved",
      owner_user_id: buyerId,
      reserved_until: new Date(Date.now() + 600_000).toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  const { data: purchase } = await client
    .from("purchases")
    .insert({
      buyer_user_id: buyerId,
      event_id: event!.id,
      ticket_id: ticket!.id,
      amount: 100,
      currency: "MAD",
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  return {
    ticketId: ticket!.id,
    eventId: event!.id,
    categoryId: cat!.id,
    purchaseId: purchase!.id,
  };
}

async function teardown(client: SupabaseClient, eventId: string) {
  await client.from("chain_ops").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await client.from("purchases").delete().eq("event_id", eventId);
  await client.from("tickets").delete().eq("event_id", eventId);
  await client.from("ticket_categories").delete().eq("event_id", eventId);
  await client.from("events").delete().eq("id", eventId);
}

test.describe("chain_ops invariants", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("only one live mint op per purchase (partial unique index)", async () => {
    const client = sb();
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");
    const fx = await seedTicket(client, buyerId);
    const baseRow = {
      op_type: "mint" as const,
      purchase_id: fx.purchaseId,
      ticket_id: fx.ticketId,
      contract_address: "0xcontract",
      token_id: 1,
      to_address: "0xbuyer",
      metadata_uri: "ipfs://meta",
    };

    const first = await client
      .from("chain_ops")
      .insert({ ...baseRow, idempotency_key: `mint:${fx.purchaseId}:1`, status: "sent" })
      .select("id")
      .single();
    expect(first.error).toBeFalsy();

    // Second live insert must violate the partial unique index.
    const second = await client
      .from("chain_ops")
      .insert({ ...baseRow, idempotency_key: `mint:${fx.purchaseId}:2`, status: "queued" })
      .select("id")
      .single();
    expect(second.error, "duplicate live mint op must be rejected").toBeTruthy();

    // After marking the first errored, a new attempt is allowed.
    await client.from("chain_ops").update({ status: "errored" }).eq("id", first.data!.id);
    const third = await client
      .from("chain_ops")
      .insert({ ...baseRow, idempotency_key: `mint:${fx.purchaseId}:3`, attempt: 2, status: "queued" })
      .select("id")
      .single();
    expect(third.error, "after errored attempt, new attempt is allowed").toBeFalsy();

    await teardown(client, fx.eventId);
  });

  test("idempotency_key is globally unique across chain_ops", async () => {
    const client = sb();
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");
    const a = await seedTicket(client, buyerId);
    const b = await seedTicket(client, buyerId);

    const sharedKey = `mint:${a.purchaseId}:1`;
    const first = await client.from("chain_ops").insert({
      op_type: "mint",
      purchase_id: a.purchaseId,
      ticket_id: a.ticketId,
      contract_address: "0x",
      token_id: 1,
      to_address: "0xb",
      idempotency_key: sharedKey,
    }).select("id").single();
    expect(first.error).toBeFalsy();

    const second = await client.from("chain_ops").insert({
      op_type: "mint",
      purchase_id: b.purchaseId,
      ticket_id: b.ticketId,
      contract_address: "0x",
      token_id: 1,
      to_address: "0xb",
      idempotency_key: sharedKey,
    }).select("id").single();
    expect(second.error, "duplicate idempotency_key must violate unique index").toBeTruthy();

    await teardown(client, a.eventId);
    await teardown(client, b.eventId);
  });

  test("op_type ↔ reference column check constraint", async () => {
    const client = sb();
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");
    const fx = await seedTicket(client, buyerId);

    // mint with no purchase_id → constraint violation
    const bad = await client.from("chain_ops").insert({
      op_type: "mint",
      purchase_id: null,
      listing_id: null,
      ticket_id: fx.ticketId,
      contract_address: "0x",
      token_id: 1,
      to_address: "0x",
      idempotency_key: `bad:${Date.now()}`,
    });
    expect(bad.error, "mint without purchase_id must violate check constraint").toBeTruthy();

    // transfer with both purchase_id + listing_id → constraint violation
    const bad2 = await client.from("chain_ops").insert({
      op_type: "transfer",
      purchase_id: fx.purchaseId,
      listing_id: null,
      ticket_id: fx.ticketId,
      contract_address: "0x",
      token_id: 1,
      to_address: "0x",
      idempotency_key: `bad2:${Date.now()}`,
    });
    expect(bad2.error, "transfer without listing_id must violate check constraint").toBeTruthy();

    await teardown(client, fx.eventId);
  });

  test("only one parallel buyer can claim a listing (active → transferring)", async () => {
    const client = sb();
    const sellerId = await getProfileIdByEmail(client, "seller@miso.local");
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");

    // Build a sold ticket + active listing without going through fulfillResale.
    const { data: event } = await client
      .from("events")
      .insert({
        name: `Race ${Date.now()}`,
        date: new Date(Date.now() + 86_400_000).toISOString(),
        venue_name: "T",
        city: "T",
        capacity: 1,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: false,
        status: "published",
        nft_contract_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
      })
      .select("id")
      .single<{ id: string }>();
    const { data: cat } = await client
      .from("ticket_categories")
      .insert({
        event_id: event!.id,
        name: "GA",
        price: 50,
        currency: "MAD",
        supply: 1,
        resale_enabled: true,
      })
      .select("id")
      .single<{ id: string }>();
    const { data: ticket } = await client
      .from("tickets")
      .insert({
        event_id: event!.id,
        category_id: cat!.id,
        serial_number: 1,
        status: "sold",
        owner_user_id: sellerId,
        owner_evm_address: "0xseller",
        nft_contract_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
        nft_token_id: 1,
      })
      .select("id")
      .single<{ id: string }>();
    const { data: listing } = await client
      .from("resale_listings")
      .insert({
        ticket_id: ticket!.id,
        seller_user_id: sellerId,
        price: 50,
        currency: "MAD",
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();
    await client
      .from("tickets")
      .update({ status: "listed", current_listing_id: listing!.id })
      .eq("id", ticket!.id);

    const claim = (claimer: string) =>
      client
        .from("resale_listings")
        .update({ status: "transferring", buyer_user_id: claimer })
        .eq("id", listing!.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();

    const [a, b] = await Promise.all([claim(buyerId), claim(sellerId)]);
    const winners = [a.data, b.data].filter(Boolean);
    expect(winners.length, "exactly one buyer claims the listing").toBe(1);

    await client.from("resale_listings").delete().eq("id", listing!.id);
    await teardown(client, event!.id);
  });
});
