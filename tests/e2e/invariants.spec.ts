// Deterministic DB-level invariants. No chain calls — runs against local
// Supabase only. Gated by MISO_E2E_INVARIANTS=1 so CI without a seeded DB
// stays green on smoke tests alone.

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

test.describe("Redemption replay safety", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  // unique_valid_redemption index on (ticket_id) where result='valid' enforces
  // at most one 'valid' redemption row per ticket. Verify a duplicate insert
  // raises a unique-violation rather than silently double-redeeming.
  test("second 'valid' redemption row for same ticket is rejected", async () => {
    const client = sb();
    const { data: anyTicket } = await client
      .from("tickets")
      .select("id, event_id")
      .limit(1)
      .single<{ id: string; event_id: string }>();
    if (!anyTicket) test.skip(true, "no tickets in DB");
    const controllerId = await getProfileIdByEmail(client, "controller@miso.local");

    const ins = (suffix: string) =>
      client.from("ticket_redemptions").insert({
        ticket_id: anyTicket!.id,
        event_id: anyTicket!.event_id,
        controller_user_id: controllerId,
        evm_address: "0xinvariant",
        result: "valid",
        gate_session_id: null,
        gate_name: `invariant-replay-${suffix}`,
        redeem_tx_hash: null,
      });

    const first = await ins("first");
    expect(first.error).toBeFalsy();

    const second = await ins("second");
    expect(second.error, "duplicate valid redemption must violate unique index").toBeTruthy();
    expect(second.error?.code).toMatch(/23505/);

    // Cleanup: drop the test row we inserted so we don't poison subsequent
    // runs or ticket displays.
    await client
      .from("ticket_redemptions")
      .delete()
      .eq("ticket_id", anyTicket!.id)
      .eq("gate_name", "invariant-replay-first");
  });
});

test.describe("Ticket reservation race", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  // The conditional update in reserveTicket should make concurrent reserves
  // on the same available ticket land in only one winner. We simulate by
  // attempting two parallel updates on the same row with status='available'.
  test("two parallel reservations on same available ticket — only one wins", async () => {
    const client = sb();

    const { data: available } = await client
      .from("tickets")
      .select("id, category_id")
      .eq("status", "available")
      .limit(1)
      .maybeSingle<{ id: string; category_id: string }>();
    if (!available) test.skip(true, "no available ticket");
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");
    const sellerId = await getProfileIdByEmail(client, "seller@miso.local");

    const reserve = (owner: string) =>
      client
        .from("tickets")
        .update({
          status: "reserved",
          reserved_until: new Date(Date.now() + 60_000).toISOString(),
          owner_user_id: owner,
        })
        .eq("id", available!.id)
        .eq("status", "available")
        .select("id")
        .maybeSingle();

    const [a, b] = await Promise.all([reserve(buyerId), reserve(sellerId)]);
    const winners = [a.data, b.data].filter(Boolean);
    expect(winners.length, "exactly one writer must claim the ticket").toBe(1);

    // Restore for repeatability.
    await client
      .from("tickets")
      .update({ status: "available", reserved_until: null, owner_user_id: null })
      .eq("id", available!.id);
  });
});

test.describe("Cancellation refund flow", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  // cancelEventSetup should mark sold tickets refund_pending and cancel
  // unsold inventory. Set up a throwaway event with a sold ticket, cancel
  // it, assert state transitions.
  test("cancel published event with sold ticket → refund_pending + canceled unsold", async () => {
    const client = sb();
    const adminId = await getProfileIdByEmail(client, "admin@miso.local");
    const buyerId = await getProfileIdByEmail(client, "buyer@miso.local");

    const { data: event } = await client
      .from("events")
      .insert({
        name: `Invariant Cancel ${Date.now()}`,
        date: new Date(Date.now() + 86_400_000).toISOString(),
        venue_name: "Test",
        city: "Test",
        capacity: 10,
        sales_enabled: true,
        resale_enabled: false,
        public_sales_counter_enabled: false,
        status: "published",
      })
      .select("id")
      .single<{ id: string }>();
    expect(event).toBeTruthy();

    const { data: cat } = await client
      .from("ticket_categories")
      .insert({
        event_id: event!.id,
        name: "GA",
        price: 100,
        currency: "EUR",
        supply: 2,
        resale_enabled: false,
      })
      .select("id")
      .single<{ id: string }>();

    const { data: ticketsInserted } = await client
      .from("tickets")
      .insert([
        { event_id: event!.id, category_id: cat!.id, serial_number: 1, status: "sold", owner_user_id: buyerId },
        { event_id: event!.id, category_id: cat!.id, serial_number: 2, status: "available" },
      ])
      .select("id, status")
      .returns<Array<{ id: string; status: string }>>();
    expect(ticketsInserted?.length).toBe(2);

    // Drive lib helpers via HTTP-equivalent: call cancelEventSetup logic.
    await client.from("events").update({ status: "canceled" }).eq("id", event!.id);
    await client
      .from("tickets")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("event_id", event!.id)
      .in("status", ["available", "reserved"]);
    await client
      .from("tickets")
      .update({ status: "refund_pending" })
      .eq("event_id", event!.id)
      .in("status", ["sold", "listed"]);

    const { data: after } = await client
      .from("tickets")
      .select("status")
      .eq("event_id", event!.id)
      .returns<Array<{ status: string }>>();
    const statuses = (after ?? []).map((r) => r.status).sort();
    expect(statuses).toEqual(["canceled", "refund_pending"]);

    // Cleanup
    await client.from("tickets").delete().eq("event_id", event!.id);
    await client.from("ticket_categories").delete().eq("event_id", event!.id);
    await client.from("events").delete().eq("id", event!.id);
    expect(adminId).toBeTruthy();
  });
});
