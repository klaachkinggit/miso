// Cross-user authorization: a logged-in user must NOT be able to mutate
// another user's listings or tickets. The HTTP routes go through
// service-role for execution but enforce ownership checks at the lib layer
// (cancelResaleListing, fulfillResale, etc.). These tests verify those gates.

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./helpers/env";
import { DEMO_BUYER, DEMO_SELLER, login } from "./helpers/auth";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getProfileIdByEmail(
  client: SupabaseClient,
  email: string,
): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single<{ id: string }>();
  if (!data) throw new Error(`Missing seeded profile ${email}`);
  return data.id;
}

// Create a sold ticket + active listing owned by `sellerEmail`. Returns ids
// so the test can attempt mutations and clean up after itself.
async function seedListingFixture(
  client: SupabaseClient,
  sellerEmail: string,
): Promise<{
  ticketId: string;
  listingId: string;
  categoryId: string;
  eventId: string;
}> {
  const sellerId = await getProfileIdByEmail(client, sellerEmail);

  const { data: event } = await client
    .from("events")
    .insert({
      name: `Authz Fixture ${Date.now()}`,
      date: new Date(Date.now() + 86_400_000).toISOString(),
      venue_name: "Test",
      city: "Test",
      capacity: 5,
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: false,
      status: "published",
    })
    .select("id")
    .single<{ id: string }>();

  const { data: category } = await client
    .from("ticket_categories")
    .insert({
      event_id: event!.id,
      name: "GA",
      price: 100,
      currency: "EUR",
      supply: 1,
      resale_enabled: true,
    })
    .select("id")
    .single<{ id: string }>();

  const { data: ticket } = await client
    .from("tickets")
    .insert({
      event_id: event!.id,
      category_id: category!.id,
      serial_number: 1,
      status: "sold",
      owner_user_id: sellerId,
      nft_contract_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
      nft_token_id: Date.now() & 0xffff,
      owner_evm_address: "0xowner",
      mint_tx_hash: `0xfixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    .select("id")
    .single<{ id: string }>();

  const { data: listing } = await client
    .from("resale_listings")
    .insert({
      ticket_id: ticket!.id,
      seller_user_id: sellerId,
      price: 100,
      currency: "EUR",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  await client
    .from("tickets")
    .update({ status: "listed", current_listing_id: listing!.id })
    .eq("id", ticket!.id);

  return {
    ticketId: ticket!.id,
    listingId: listing!.id,
    categoryId: category!.id,
    eventId: event!.id,
  };
}

async function teardown(client: SupabaseClient, ids: { eventId: string }) {
  await client
    .from("resale_listings")
    .delete()
    .eq("seller_user_id", "00000000-0000-0000-0000-000000000000");
  await client.from("tickets").delete().eq("event_id", ids.eventId);
  await client.from("resale_listings").delete().eq("ticket_id", ids.eventId);
  await client.from("ticket_categories").delete().eq("event_id", ids.eventId);
  await client.from("events").delete().eq("id", ids.eventId);
}

test.describe("Cross-user authz", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("non-owner cannot cancel another user's listing", async ({ page }) => {
    const client = sb();
    const fixture = await seedListingFixture(client, DEMO_BUYER.email);

    // Login as seller (not the listing owner) — try to cancel buyer's listing.
    await login(page, DEMO_SELLER);
    const res = await page.request.delete(
      `/api/marketplace/listings/${fixture.listingId}`,
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body?.error ?? "").toLowerCase()).toContain(
      "not listing owner",
    );

    // Listing should still be active.
    const { data: stillActive } = await client
      .from("resale_listings")
      .select("status")
      .eq("id", fixture.listingId)
      .single<{ status: string }>();
    expect(stillActive?.status).toBe("active");

    // Teardown
    await client.from("resale_listings").delete().eq("id", fixture.listingId);
    await teardown(client, { eventId: fixture.eventId });
  });

  test("user cannot buy their own listing", async ({ page }) => {
    const client = sb();
    const fixture = await seedListingFixture(client, DEMO_BUYER.email);

    await login(page, DEMO_BUYER);
    const res = await page.request.post(
      "/api/stripe-marketplace/checkout/resale",
      {
        data: { listing_id: fixture.listingId },
      },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body?.error ?? "").toLowerCase()).toContain("own listing");

    await client.from("resale_listings").delete().eq("id", fixture.listingId);
    await teardown(client, { eventId: fixture.eventId });
  });

  test("controller cannot use the marketplace (purchase, list, cancel)", async ({
    page,
  }) => {
    // Controller route guards return 403 with this message — ensure all three
    // marketplace endpoints reject controller role regardless of payload.
    await login(page, {
      email: process.env.DEMO_CONTROLLER_EMAIL ?? "controller@miso.local",
      password: process.env.DEMO_CONTROLLER_PASSWORD ?? "misocontroller",
    });

    const listRes = await page.request.post("/api/marketplace/listings", {
      data: { ticket_id: "00000000-0000-0000-0000-000000000000", price: 100 },
    });
    expect(listRes.status()).toBe(403);

    const checkoutRes = await page.request.post(
      "/api/stripe-marketplace/checkout/resale",
      {
        data: { listing_id: "00000000-0000-0000-0000-000000000000" },
      },
    );
    expect(checkoutRes.status()).toBe(403);

    const delRes = await page.request.delete(
      "/api/marketplace/listings/00000000-0000-0000-0000-000000000000",
    );
    expect(delRes.status()).toBe(403);
  });

  test("controller cannot drive /api/stripe-marketplace/checkout/primary", async ({
    page,
  }) => {
    await login(page, {
      email: process.env.DEMO_CONTROLLER_EMAIL ?? "controller@miso.local",
      password: process.env.DEMO_CONTROLLER_PASSWORD ?? "misocontroller",
    });
    const res = await page.request.post(
      "/api/stripe-marketplace/checkout/primary",
      {
        data: { category_id: "00000000-0000-0000-0000-000000000000" },
      },
    );
    expect(res.status()).toBe(403);
  });

  test("non-owner cannot transfer another user's ticket to personal wallet", async ({
    page,
  }) => {
    const client = sb();
    const buyerId = await getProfileIdByEmail(client, DEMO_BUYER.email);

    const { data: event } = await client
      .from("events")
      .insert({
        name: `Wallet Export Authz ${Date.now()}`,
        date: new Date(Date.now() - 86_400_000).toISOString(),
        venue_name: "Test",
        city: "Test",
        capacity: 1,
        status: "published",
      })
      .select("id")
      .single<{ id: string }>();

    const { data: category } = await client
      .from("ticket_categories")
      .insert({
        event_id: event!.id,
        name: "GA",
        price: 100,
        currency: "EUR",
        supply: 1,
        resale_enabled: true,
      })
      .select("id")
      .single<{ id: string }>();

    const { data: ticket, error: ticketError } = await client
      .from("tickets")
      .insert({
        event_id: event!.id,
        category_id: category!.id,
        serial_number: 1,
        status: "sold",
        owner_user_id: buyerId,
        owner_evm_address: "0x1111111111111111111111111111111111111111",
        nft_contract_address: "0x2222222222222222222222222222222222222222",
        nft_token_id: Date.now(),
      })
      .select("id")
      .single<{ id: string }>();

    if (ticketError) console.error("TICKET INSERT ERROR:", ticketError);

    await login(page, DEMO_SELLER);
    const res = await page.request.post("/api/tickets/transfer-to-wallet", {
      data: {
        ticket_id: ticket!.id,
        destination_address: "0x3333333333333333333333333333333333333333",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body?.error ?? "").toLowerCase()).toContain(
      "not ticket owner",
    );

    const { data: unchanged } = await client
      .from("tickets")
      .select("transferred_off_platform_at, owner_evm_address")
      .eq("id", ticket!.id)
      .single<{
        transferred_off_platform_at: string | null;
        owner_evm_address: string | null;
      }>();
    expect(unchanged?.transferred_off_platform_at).toBeNull();
    expect(unchanged?.owner_evm_address).toBe(
      "0x1111111111111111111111111111111111111111",
    );

    await client.from("tickets").delete().eq("id", ticket!.id);
    await client.from("ticket_categories").delete().eq("id", category!.id);
    await client.from("events").delete().eq("id", event!.id);
  });
});
