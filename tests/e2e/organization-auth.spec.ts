import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./helpers/env";
import { login } from "./helpers/auth";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";
const ORG_CONTROLLER = {
  email: "org-controller-authz@miso.local",
  password: ["miso", "orgcontroller"].join(""),
};

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureOrgController(client: SupabaseClient): Promise<string> {
  const { data: existing } = await client
    .from("profiles")
    .select("id")
    .eq("email", ORG_CONTROLLER.email)
    .maybeSingle<{ id: string }>();
  if (existing?.id) {
    await client
      .from("profiles")
      .update({ role: "user" })
      .eq("id", existing.id);
    return existing.id;
  }

  const created = await client.auth.admin.createUser({
    email: ORG_CONTROLLER.email,
    password: ORG_CONTROLLER.password,
    email_confirm: true,
    user_metadata: { full_name: "Org Controller Authz" },
  });
  const userId = created.data.user!.id;
  await client.from("profiles").upsert({
    id: userId,
    email: ORG_CONTROLLER.email,
    display_name: "Org Controller Authz",
    role: "user",
  });
  return userId;
}

test.describe("Organization auth app boundary", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("organization controller uses assigned gates but cannot use same-org buyer flows", async ({
    page,
  }) => {
    const client = sb();
    const userId = await ensureOrgController(client);

    const { data: event } = await client
      .from("events")
      .select("id, organization_id")
      .eq("name", "Midnight Frequency")
      .single<{ id: string; organization_id: string }>();
    expect(event).toBeTruthy();

    const { data: category } = await client
      .from("ticket_categories")
      .select("id")
      .eq("event_id", event!.id)
      .limit(1)
      .single<{ id: string }>();
    expect(category).toBeTruthy();

    const { data: seller } = await client
      .from("profiles")
      .select("id")
      .eq("email", "seller@miso.local")
      .single<{ id: string }>();
    expect(seller).toBeTruthy();

    const { data: ticket } = await client
      .from("tickets")
      .insert({
        event_id: event!.id,
        category_id: category!.id,
        serial_number: Math.floor(Date.now() / 1000),
        status: "sold",
        owner_user_id: seller!.id,
      })
      .select("id")
      .single<{ id: string }>();

    const { data: listing } = await client
      .from("resale_listings")
      .insert({
        ticket_id: ticket!.id,
        seller_user_id: seller!.id,
        price: 100,
        currency: "EUR",
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();

    await client.from("organization_memberships").upsert(
      {
        organization_id: event!.organization_id,
        user_id: userId,
        role: "controller",
      },
      { onConflict: "organization_id,user_id" },
    );
    await client
      .from("event_controllers")
      .upsert({ event_id: event!.id, user_id: userId });

    await login(page, ORG_CONTROLLER);

    const gateRes = await page.request.post("/api/controller/gates", {
      data: {
        event_id: event!.id,
        gate_name: "Org membership gate",
        ttl_hours: 1,
      },
    });
    expect(gateRes.status()).toBe(200);
    const gate = await gateRes.json();

    await client
      .from("event_controllers")
      .delete()
      .eq("event_id", event!.id)
      .eq("user_id", userId);
    const staleGatePollRes = await page.request.get(
      `/api/controller/gates/${gate.id}`,
    );
    expect(staleGatePollRes.status()).toBe(403);

    const checkoutRes = await page.request.post(
      "/api/stripe-marketplace/checkout/primary",
      {
        data: { category_id: category!.id, quantity: 1 },
      },
    );
    expect(checkoutRes.status()).toBe(403);

    const listRes = await page.request.post("/api/marketplace/listings", {
      data: { ticket_id: ticket!.id, price: 100 },
    });
    expect(listRes.status()).toBe(403);

    const resaleCheckoutRes = await page.request.post(
      "/api/stripe-marketplace/checkout/resale",
      {
        data: { listing_id: listing!.id },
      },
    );
    expect(resaleCheckoutRes.status()).toBe(403);

    await client.from("gate_sessions").delete().eq("id", gate.id);
    await client.from("resale_listings").delete().eq("id", listing!.id);
    await client.from("tickets").delete().eq("id", ticket!.id);
    await client
      .from("organization_memberships")
      .delete()
      .eq("organization_id", event!.organization_id)
      .eq("user_id", userId);
  });
});
