// Controller verify flow.
//
// Coverage:
//   - controller landing page lists assigned events
//   - controller can open a gate session via API → poll → close
//   - cross-controller authz: controller A cannot read controller B's gate
//   - non-controller users get 403 on gate endpoints

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_BUYER, login } from "./helpers/auth";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

const DEMO_CONTROLLER = {
  email: process.env.DEMO_CONTROLLER_EMAIL ?? "controller@miso.local",
  password: process.env.DEMO_CONTROLLER_PASSWORD ?? "misocontroller",
};

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test.describe("Controller flow", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("controller landing page lists assigned events", async ({ page }) => {
    await login(page, DEMO_CONTROLLER);
    await page.goto("/controller");
    await expect(page.getByRole("heading", { name: "Controller" })).toBeVisible();
    // Seeded demo event is assigned to the demo controller.
    await expect(
      page.getByRole("heading", { name: "Miso Demo Night" }).first(),
    ).toBeVisible();
  });

  test("controller can open + poll + close a gate session", async ({ page }) => {
    await login(page, DEMO_CONTROLLER);

    const client = sb();
    const { data: event } = await client
      .from("events")
      .select("id")
      .eq("name", "Miso Demo Night")
      .single<{ id: string }>();
    expect(event).toBeTruthy();

    // Open a gate.
    const openRes = await page.request.post("/api/controller/gates", {
      data: { event_id: event!.id, gate_name: "Main", ttl_hours: 2 },
    });
    expect(openRes.status()).toBe(200);
    const session = await openRes.json();
    expect(session.short_code).toMatch(/^[A-Z2-9]{8}$/);

    // Poll it.
    const pollRes = await page.request.get(`/api/controller/gates/${session.id}`);
    expect(pollRes.status()).toBe(200);
    const poll = await pollRes.json();
    expect(poll.session.id).toBe(session.id);

    // Close it.
    const closeRes = await page.request.post(
      `/api/controller/gates/${session.id}/close`,
    );
    expect(closeRes.status()).toBe(200);
    const closed = await closeRes.json();
    expect(closed.status).toBe("closed");

    // Cleanup: delete the gate row so we don't accumulate test data.
    await client.from("gate_sessions").delete().eq("id", session.id);
  });

  test("non-controller user cannot open a gate", async ({ page }) => {
    await login(page, DEMO_BUYER);
    const res = await page.request.post("/api/controller/gates", {
      data: { event_id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(403);
  });

  test("non-controller user cannot poll a gate", async ({ page }) => {
    await login(page, DEMO_BUYER);
    const res = await page.request.get(
      "/api/controller/gates/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(403);
  });

  test("controller cannot poll a gate belonging to another controller", async ({ page }) => {
    const client = sb();
    // Create a second controller user + an event with that user assigned, then
    // open a gate as that user. Login as the demo controller and try to poll.
    const { data: existing } = await client
      .from("profiles")
      .select("id")
      .eq("email", "controller-b@miso.local")
      .maybeSingle<{ id: string }>();
    let otherUserId = existing?.id;
    if (!otherUserId) {
      const created = await client.auth.admin.createUser({
        email: "controller-b@miso.local",
        password: "misocontrollerb",
        email_confirm: true,
        user_metadata: { full_name: "Controller B" },
      });
      otherUserId = created.data.user!.id;
      await client.from("profiles").upsert({
        id: otherUserId,
        email: "controller-b@miso.local",
        display_name: "Controller B",
        role: "controller",
      });
    }

    const { data: event } = await client
      .from("events")
      .select("id")
      .eq("name", "Miso Demo Night")
      .single<{ id: string }>();
    expect(event).toBeTruthy();

    await client
      .from("event_controllers")
      .upsert({ event_id: event!.id, user_id: otherUserId });

    // Open a gate as controller-b directly via DB (skipping HTTP login flow).
    const shortCode = `XX${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const { data: otherGate } = await client
      .from("gate_sessions")
      .insert({
        event_id: event!.id,
        controller_user_id: otherUserId,
        gate_name: "Other gate",
        short_code: shortCode,
        status: "open",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    expect(otherGate).toBeTruthy();

    await login(page, DEMO_CONTROLLER);
    const res = await page.request.get(
      `/api/controller/gates/${otherGate!.id}`,
    );
    expect(res.status()).toBe(403);

    await client.from("gate_sessions").delete().eq("id", otherGate!.id);
    await client
      .from("event_controllers")
      .delete()
      .eq("event_id", event!.id)
      .eq("user_id", otherUserId);
  });
});
