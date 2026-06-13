// Stripe marketplace DB-level invariants.
//
// No Stripe API calls — exercises the constraints + RPC added in
// migrations 0017/0018 against the local Postgres. Gated by
// MISO_E2E_INVARIANTS=1 like the rest of the invariants suite.

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

async function buyer(client: SupabaseClient): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", "buyer@miso.local")
    .single<{ id: string }>();
  if (!data) throw new Error("Seed buyer missing");
  return data.id;
}

async function seller(client: SupabaseClient): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", "seller@miso.local")
    .single<{ id: string }>();
  if (!data) throw new Error("Seed seller missing");
  return data.id;
}

async function organizer(client: SupabaseClient): Promise<string> {
  // Reuse admin as organizer for seed simplicity.
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", "admin@miso.local")
    .single<{ id: string }>();
  if (!data) throw new Error("Seed admin missing");
  return data.id;
}

async function pickPurchase(client: SupabaseClient): Promise<{ id: string }> {
  const { data } = await client
    .from("purchases")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!data) test.skip(true, "no purchase in DB");
  return data!;
}

async function pickListing(client: SupabaseClient): Promise<{ id: string }> {
  const { data } = await client
    .from("resale_listings")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!data) test.skip(true, "no resale_listing in DB");
  return data!;
}

const STRIPE_ACCT = "acct_stripe_marketplace_e2e";

async function freshStripeAccount(
  client: SupabaseClient,
  userId: string,
  riskStatus: "clear" | "restricted" | "owes_recovery" | "blocked" = "clear",
): Promise<void> {
  await client.from("stripe_seller_accounts").delete().eq("user_id", userId);
  await client.from("stripe_seller_accounts").insert({
    user_id: userId,
    stripe_account_id: `${STRIPE_ACCT}_${userId.slice(0, 6)}_${Date.now()}`,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    seller_risk_status: riskStatus,
  });
}

test.describe("marketplace_payments CHECK constraints", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("amount_split CHECK rejects mismatched cents", async () => {
    const client = sb();
    const b = await buyer(client);
    const s = await seller(client);
    const { error } = await client.from("marketplace_payments").insert({
      kind: "primary",
      buyer_user_id: b,
      primary_seller_user_id: s,
      organizer_user_id: s,
      purchase_id: (await pickPurchase(client)).id,
      amount_total_cents: 10_000,
      currency: "EUR",
      marketplace_fee_bps: 500,
      marketplace_fee_cents: 500,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: 9_499, // off by 1
      stripe_transfer_group: `tg_${Date.now()}_split`,
    });
    expect(error?.message ?? "").toMatch(/amount_split/);
  });

  test("currency_eur_only rejects MAD payments", async () => {
    const client = sb();
    const b = await buyer(client);
    const s = await seller(client);
    const { error } = await client.from("marketplace_payments").insert({
      kind: "primary",
      buyer_user_id: b,
      primary_seller_user_id: s,
      organizer_user_id: s,
      purchase_id: (await pickPurchase(client)).id,
      amount_total_cents: 1_000,
      currency: "MAD",
      marketplace_fee_bps: 0,
      marketplace_fee_cents: 0,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: 1_000,
      stripe_transfer_group: `tg_${Date.now()}_mad`,
    });
    expect(error?.message ?? "").toMatch(/currency_eur_only/);
  });

  test("exactly_one_target enforces primary↔purchase_id", async () => {
    const client = sb();
    const b = await buyer(client);
    const s = await seller(client);
    const purchase = await pickPurchase(client);
    const listing = await pickListing(client);
    const { error } = await client.from("marketplace_payments").insert({
      kind: "primary",
      buyer_user_id: b,
      primary_seller_user_id: s,
      organizer_user_id: s,
      purchase_id: purchase.id,
      resale_listing_id: listing.id, // primary must not have a listing
      amount_total_cents: 1_000,
      currency: "EUR",
      marketplace_fee_bps: 0,
      marketplace_fee_cents: 0,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: 1_000,
      stripe_transfer_group: `tg_${Date.now()}_target`,
    });
    expect(error?.message ?? "").toMatch(/exactly_one_target/);
  });

  test("royalty_needs_organizer rejects royalty>0 with null organizer", async () => {
    const client = sb();
    const b = await buyer(client);
    const s = await seller(client);
    const listing = await pickListing(client);
    const { error } = await client.from("marketplace_payments").insert({
      kind: "resale",
      buyer_user_id: b,
      primary_seller_user_id: s,
      organizer_user_id: null,
      resale_listing_id: listing.id,
      amount_total_cents: 1_000,
      currency: "EUR",
      marketplace_fee_bps: 0,
      marketplace_fee_cents: 0,
      organizer_royalty_bps: 100,
      organizer_royalty_cents: 100,
      primary_seller_cents: 900,
      stripe_transfer_group: `tg_${Date.now()}_royalty`,
    });
    expect(error?.message ?? "").toMatch(/royalty_needs_organizer/);
  });
});

test.describe("marketplace_payments live-status partial unique index", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("two live payments for same purchase rejected; second succeeds after first set failed", async () => {
    const client = sb();
    const b = await buyer(client);
    const s = await seller(client);
    const purchase = await pickPurchase(client);

    // Clear any prior rows so this test is deterministic.
    await client
      .from("marketplace_payments")
      .delete()
      .eq("purchase_id", purchase.id);

    const insertLive = async (tag: string) =>
      client
        .from("marketplace_payments")
        .insert({
          kind: "primary",
          buyer_user_id: b,
          primary_seller_user_id: s,
          organizer_user_id: s,
          purchase_id: purchase.id,
          amount_total_cents: 1_000,
          currency: "EUR",
          marketplace_fee_bps: 0,
          marketplace_fee_cents: 0,
          organizer_royalty_bps: 0,
          organizer_royalty_cents: 0,
          primary_seller_cents: 1_000,
          stripe_transfer_group: `tg_uniq_${tag}_${Date.now()}`,
          status: "requires_payment",
        })
        .select("id")
        .single<{ id: string }>();

    const first = await insertLive("a");
    expect(first.error).toBeNull();
    const second = await insertLive("b");
    expect(second.error?.message ?? "").toMatch(
      /marketplace_payments_purchase_live_uniq/,
    );

    // Mark the first one failed, then a fresh insert must succeed.
    await client
      .from("marketplace_payments")
      .update({ status: "failed" })
      .eq("id", first.data!.id);
    const retried = await insertLive("c");
    expect(retried.error).toBeNull();

    // Cleanup.
    await client
      .from("marketplace_payments")
      .delete()
      .eq("purchase_id", purchase.id);
  });
});

test.describe("apply_stripe_account_snapshot RPC", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("preserves owes_recovery even when Stripe reports ready", async () => {
    const client = sb();
    const orgId = await organizer(client);
    await freshStripeAccount(client, orgId, "owes_recovery");

    const { data: row, error } = await client
      .from("stripe_seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", orgId)
      .single<{ stripe_account_id: string }>();
    expect(error).toBeNull();

    const rpc = await client.rpc("apply_stripe_account_snapshot", {
      p_user_id: orgId,
      p_stripe_account_id: row!.stripe_account_id,
      p_charges_enabled: true,
      p_payouts_enabled: true,
      p_details_submitted: true,
      p_disabled_reason: null,
      p_requirements_json: null,
    });
    expect(rpc.error).toBeNull();
    const result = rpc.data as { seller_risk_status: string } | null;
    expect(result?.seller_risk_status).toBe("owes_recovery");

    await client.from("stripe_seller_accounts").delete().eq("user_id", orgId);
  });

  test("flips clear → restricted when Stripe disables charges", async () => {
    const client = sb();
    const orgId = await organizer(client);
    await freshStripeAccount(client, orgId, "clear");

    const { data: row } = await client
      .from("stripe_seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", orgId)
      .single<{ stripe_account_id: string }>();

    const rpc = await client.rpc("apply_stripe_account_snapshot", {
      p_user_id: orgId,
      p_stripe_account_id: row!.stripe_account_id,
      p_charges_enabled: false,
      p_payouts_enabled: true,
      p_details_submitted: true,
      p_disabled_reason: "requirements.past_due",
      p_requirements_json: null,
    });
    expect(rpc.error).toBeNull();
    const result = rpc.data as { seller_risk_status: string } | null;
    expect(result?.seller_risk_status).toBe("restricted");

    await client.from("stripe_seller_accounts").delete().eq("user_id", orgId);
  });

  test("flips restricted → clear when Stripe re-enables", async () => {
    const client = sb();
    const orgId = await organizer(client);
    await freshStripeAccount(client, orgId, "restricted");

    const { data: row } = await client
      .from("stripe_seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", orgId)
      .single<{ stripe_account_id: string }>();

    const rpc = await client.rpc("apply_stripe_account_snapshot", {
      p_user_id: orgId,
      p_stripe_account_id: row!.stripe_account_id,
      p_charges_enabled: true,
      p_payouts_enabled: true,
      p_details_submitted: true,
      p_disabled_reason: null,
      p_requirements_json: null,
    });
    expect(rpc.error).toBeNull();
    const result = rpc.data as { seller_risk_status: string } | null;
    expect(result?.seller_risk_status).toBe("clear");

    await client.from("stripe_seller_accounts").delete().eq("user_id", orgId);
  });
});

test.describe("Stripe marketplace API surface auth", () => {
  test("POST /api/stripe-marketplace/checkout/primary rejects unauthenticated", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/stripe-marketplace/checkout/primary",
      {
        data: { category_id: "00000000-0000-4000-8000-000000000000" },
        failOnStatusCode: false,
      },
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/stripe-marketplace/checkout/resale rejects unauthenticated", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/stripe-marketplace/checkout/resale",
      {
        data: { listing_id: "00000000-0000-4000-8000-000000000000" },
        failOnStatusCode: false,
      },
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/stripe-marketplace/onboarding/link rejects unauthenticated", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/stripe-marketplace/onboarding/link",
      { data: {}, failOnStatusCode: false },
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/stripe-marketplace/webhook rejects requests without signature", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/stripe-marketplace/webhook",
      { data: { hello: "world" }, failOnStatusCode: false },
    );
    // Without a valid stripe-signature header, the route should return
    // 400 (WebhookSignatureError). It must NOT return 200.
    expect(res.status()).toBe(400);
  });
});
