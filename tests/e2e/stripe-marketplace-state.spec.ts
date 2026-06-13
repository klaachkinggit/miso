// State-machine tests for the Stripe marketplace webhook handlers.
//
// These exercise settleFailedPaymentIntent / settleCanceledPaymentIntent
// directly against the local DB so the retry-safety contract is locked
// in (CRIT pass-3 fix):
//   * payment_intent.payment_failed   → soft note, NO terminalize, NO release
//   * payment_intent.canceled         → terminalize + release
//
// No Stripe API calls. Gated by MISO_E2E_INVARIANTS=1.

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  settleCanceledPaymentIntent,
  settleFailedPaymentIntent,
} from "@/lib/stripe-marketplace/fulfillment";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function buyerId(client: SupabaseClient): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", "buyer@miso.local")
    .single<{ id: string }>();
  if (!data) throw new Error("Seed buyer missing");
  return data.id;
}

async function sellerId(client: SupabaseClient): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", "seller@miso.local")
    .single<{ id: string }>();
  if (!data) throw new Error("Seed seller missing");
  return data.id;
}

async function reservePurchase(client: SupabaseClient): Promise<{
  purchaseId: string;
  ticketId: string;
}> {
  const buyer = await buyerId(client);
  // Find an available ticket from any seeded event.
  const { data: ticket } = await client
    .from("tickets")
    .select("id, event_id, category_id")
    .eq("status", "available")
    .limit(1)
    .maybeSingle<{ id: string; event_id: string; category_id: string }>();
  if (!ticket) test.skip(true, "no available ticket to reserve");

  // Reserve it.
  await client
    .from("tickets")
    .update({
      status: "reserved",
      reserved_until: new Date(Date.now() + 10 * 60_000).toISOString(),
      owner_user_id: buyer,
    })
    .eq("id", ticket!.id);

  // Create a purchase row.
  const { data: purchase } = await client
    .from("purchases")
    .insert({
      buyer_user_id: buyer,
      event_id: ticket!.event_id,
      ticket_id: ticket!.id,
      amount: 100,
      currency: "EUR",
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (!purchase) throw new Error("purchase insert failed");
  return { purchaseId: purchase.id, ticketId: ticket!.id };
}

async function insertMarketplacePayment(client: SupabaseClient, input: {
  purchaseId: string;
  buyer: string;
  seller: string;
  paymentIntentId: string;
  status: string;
}): Promise<string> {
  const { data, error } = await client
    .from("marketplace_payments")
    .insert({
      kind: "primary",
      buyer_user_id: input.buyer,
      primary_seller_user_id: input.seller,
      organizer_user_id: input.seller,
      purchase_id: input.purchaseId,
      amount_total_cents: 10_000,
      currency: "EUR",
      marketplace_fee_bps: 500,
      marketplace_fee_cents: 500,
      organizer_royalty_bps: 0,
      organizer_royalty_cents: 0,
      primary_seller_cents: 9_500,
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_transfer_group: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: input.status,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw error ?? new Error("payment insert failed");
  return data.id;
}

async function cleanup(client: SupabaseClient, ids: {
  paymentId?: string;
  purchaseId?: string;
  ticketId?: string;
}) {
  if (ids.paymentId) await client.from("marketplace_payments").delete().eq("id", ids.paymentId);
  if (ids.purchaseId) await client.from("purchases").delete().eq("id", ids.purchaseId);
  if (ids.ticketId) {
    await client
      .from("tickets")
      .update({ status: "available", reserved_until: null, owner_user_id: null })
      .eq("id", ids.ticketId);
  }
}

test.describe("Stripe webhook state machine", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("payment_intent.payment_failed does NOT terminalize or release", async () => {
    const client = sb();
    const buyer = await buyerId(client);
    const seller = await sellerId(client);
    const { purchaseId, ticketId } = await reservePurchase(client);
    const piId = `pi_test_failed_${Date.now()}`;
    const paymentId = await insertMarketplacePayment(client, {
      purchaseId,
      buyer,
      seller,
      paymentIntentId: piId,
      status: "processing",
    });

    try {
      const result = await settleFailedPaymentIntent({
        paymentIntentId: piId,
        failureMessage: "card_declined",
      });
      expect(result).not.toBeNull();
      // Status MUST remain processing — Stripe may retry the PI with
      // another payment method.
      expect(result!.status).toBe("processing");
      expect(result!.failure_reason).toContain("card_declined");

      // Ticket reservation MUST still be held.
      const { data: ticket } = await client
        .from("tickets")
        .select("status, owner_user_id")
        .eq("id", ticketId)
        .single<{ status: string; owner_user_id: string }>();
      expect(ticket!.status).toBe("reserved");
      expect(ticket!.owner_user_id).toBe(buyer);

      // Purchase row still pending.
      const { data: purchase } = await client
        .from("purchases")
        .select("status")
        .eq("id", purchaseId)
        .single<{ status: string }>();
      expect(purchase!.status).toBe("pending");
    } finally {
      await cleanup(client, { paymentId, purchaseId, ticketId });
    }
  });

  test("payment_intent.canceled terminalizes + releases inventory", async () => {
    const client = sb();
    const buyer = await buyerId(client);
    const seller = await sellerId(client);
    const { purchaseId, ticketId } = await reservePurchase(client);
    const piId = `pi_test_canceled_${Date.now()}`;
    const paymentId = await insertMarketplacePayment(client, {
      purchaseId,
      buyer,
      seller,
      paymentIntentId: piId,
      status: "processing",
    });

    try {
      const result = await settleCanceledPaymentIntent({
        paymentIntentId: piId,
        cancellationReason: "abandoned",
      });
      expect(result!.status).toBe("failed");
      expect(result!.failure_reason).toContain("abandoned");

      // Ticket back to available.
      const { data: ticket } = await client
        .from("tickets")
        .select("status, owner_user_id")
        .eq("id", ticketId)
        .single<{ status: string; owner_user_id: string | null }>();
      expect(ticket!.status).toBe("available");
      expect(ticket!.owner_user_id).toBeNull();

      // Purchase marked failed.
      const { data: purchase } = await client
        .from("purchases")
        .select("status")
        .eq("id", purchaseId)
        .single<{ status: string }>();
      expect(purchase!.status).toBe("failed");
    } finally {
      await cleanup(client, { paymentId });
      await client.from("purchases").delete().eq("id", purchaseId);
      await client
        .from("tickets")
        .update({ status: "available", reserved_until: null, owner_user_id: null })
        .eq("id", ticketId);
    }
  });

  test("payment_intent.canceled is idempotent on paid payments", async () => {
    const client = sb();
    const buyer = await buyerId(client);
    const seller = await sellerId(client);
    const { purchaseId, ticketId } = await reservePurchase(client);
    const piId = `pi_test_paid_${Date.now()}`;
    const paymentId = await insertMarketplacePayment(client, {
      purchaseId,
      buyer,
      seller,
      paymentIntentId: piId,
      status: "paid",
    });

    try {
      const result = await settleCanceledPaymentIntent({
        paymentIntentId: piId,
      });
      // Paid row is short-circuit returned unchanged.
      expect(result!.status).toBe("paid");
    } finally {
      await cleanup(client, { paymentId, purchaseId, ticketId });
    }
  });

  test("payment_intent.payment_failed returns null for unknown intent", async () => {
    const result = await settleFailedPaymentIntent({
      paymentIntentId: "pi_does_not_exist_xyz",
    });
    expect(result).toBeNull();
  });
});
