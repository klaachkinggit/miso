// Organization foundation invariants. No chain calls — validates that the
// platform migration creates the Organization boundary without breaking legacy
// event fixtures during the strangler transition.

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./helpers/env";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

function serviceSb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function authedSb(email: string, password: string): Promise<SupabaseClient> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) test.skip(true, "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to sign in ${email}: ${error.message}`);
  return client;
}

async function getMisoOrganizationId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("organizations")
    .select("id")
    .eq("slug", "miso")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Missing Miso organization: ${error?.message}`);
  return data.id;
}

test.describe("Organization foundation", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("demo seed creates Miso organization, memberships, and scoped events", async () => {
    const client = serviceSb();
    const organizationId = await getMisoOrganizationId(client);

    const { data: memberships } = await client
      .from("organization_memberships")
      .select("role, profiles!inner(email)")
      .eq("organization_id", organizationId)
      .returns<Array<{ role: string; profiles: { email: string } }>>();

    const rolesByEmail = new Map((memberships ?? []).map((row) => [row.profiles.email, row.role]));
    expect(rolesByEmail.get("organizer@miso.local")).toBe("admin");
    expect(rolesByEmail.get("admin@miso.local")).toBe("admin");
    expect(rolesByEmail.get("controller@miso.local")).toBe("controller");

    const { data: events } = await client
      .from("events")
      .select("name, organization_id, slug")
      .in("name", ["Midnight Frequency", "Berlin Boiler Set", "London Skyline Sessions"])
      .returns<Array<{ name: string; organization_id: string | null; slug: string | null }>>();

    expect(events?.length ?? 0).toBeGreaterThan(0);
    for (const event of events ?? []) {
      expect(event.organization_id).toBe(organizationId);
      expect(event.slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    }
  });

  test("legacy event insert still works until app code is fully organization-aware", async () => {
    const client = serviceSb();
    const { data: event, error } = await client
      .from("events")
      .insert({
        name: `Legacy Compatibility ${Date.now()}`,
        date: new Date(Date.now() + 86_400_000).toISOString(),
        venue_name: "Test",
        city: "Test",
        capacity: 1,
        status: "draft",
      })
      .select("id, organization_id, slug")
      .single<{ id: string; organization_id: string | null; slug: string | null }>();

    expect(error).toBeFalsy();
    expect(event?.organization_id).toBeNull();
    expect(event?.slug).toBeNull();

    await client.from("events").delete().eq("id", event!.id);
  });

  test("organization slug uniqueness is enforced", async () => {
    const client = serviceSb();
    const duplicate = await client
      .from("organizations")
      .insert({ name: "Duplicate Miso", slug: "miso" });

    expect(duplicate.error, "duplicate organization slug must violate unique constraint").toBeTruthy();
    expect(duplicate.error?.code).toMatch(/23505/);
  });

  test("organization RLS allows admins, denies nonmembers, and blocks controllers from mutation", async () => {
    const service = serviceSb();
    const organizationId = await getMisoOrganizationId(service);

    const buyer = await authedSb("buyer@miso.local", "misobuyer");
    const buyerRead = await buyer
      .from("organizations")
      .select("id")
      .eq("slug", "miso")
      .returns<Array<{ id: string }>>();
    expect(buyerRead.error).toBeFalsy();
    expect(buyerRead.data).toEqual([]);

    const organizer = await authedSb("organizer@miso.local", "misoorganizer");
    const organizerRead = await organizer
      .from("organizations")
      .select("id, branding")
      .eq("slug", "miso")
      .single<{ id: string; branding: unknown }>();
    expect(organizerRead.error).toBeFalsy();
    expect(organizerRead.data?.id).toBe(organizationId);

    const controller = await authedSb("controller@miso.local", "misocontroller");
    const controllerUpdate = await controller
      .from("organizations")
      .update({ branding: { blocked: true } })
      .eq("id", organizationId)
      .select("id");
    expect(controllerUpdate.error).toBeFalsy();
    expect(controllerUpdate.data).toEqual([]);
  });

  test("organization membership controller is blocked from admin mutation even without global controller role", async () => {
    const service = serviceSb();
    const organizationId = await getMisoOrganizationId(service);
    const { data: buyerProfile } = await service
      .from("profiles")
      .select("id")
      .eq("email", "buyer@miso.local")
      .single<{ id: string }>();
    expect(buyerProfile).toBeTruthy();

    await service
      .from("organization_memberships")
      .upsert(
        {
          organization_id: organizationId,
          user_id: buyerProfile!.id,
          role: "controller",
        },
        { onConflict: "organization_id,user_id" },
      );

    const buyer = await authedSb("buyer@miso.local", "misobuyer");
    const controllerUpdate = await buyer
      .from("organizations")
      .update({ branding: { blocked: true } })
      .eq("id", organizationId)
      .select("id");
    expect(controllerUpdate.error).toBeFalsy();
    expect(controllerUpdate.data).toEqual([]);

    await service
      .from("organization_memberships")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", buyerProfile!.id);
  });

  test("future purchase, listing, redemption writes derive organization and customer rows", async () => {
    const client = serviceSb();
    const organizationId = await getMisoOrganizationId(client);
    const { data: buyer } = await client
      .from("profiles")
      .select("id")
      .eq("email", "buyer@miso.local")
      .single<{ id: string }>();
    const { data: seller } = await client
      .from("profiles")
      .select("id")
      .eq("email", "seller@miso.local")
      .single<{ id: string }>();
    const { data: controller } = await client
      .from("profiles")
      .select("id")
      .eq("email", "controller@miso.local")
      .single<{ id: string }>();
    expect(buyer && seller && controller).toBeTruthy();

    const { data: event } = await client
      .from("events")
      .insert({
        name: `Organization Trigger ${Date.now()}`,
        date: new Date(Date.now() + 86_400_000).toISOString(),
        venue_name: "Test",
        city: "Test",
        capacity: 2,
        status: "published",
        organization_id: organizationId,
        slug: `organization-trigger-${Date.now()}`,
      })
      .select("id")
      .single<{ id: string }>();
    const { data: category } = await client
      .from("ticket_categories")
      .insert({
        event_id: event!.id,
        name: "GA",
        price: 10,
        currency: "EUR",
        supply: 2,
      })
      .select("id")
      .single<{ id: string }>();
    const { data: tickets } = await client
      .from("tickets")
      .insert([
        { event_id: event!.id, category_id: category!.id, serial_number: 1, status: "reserved" },
        { event_id: event!.id, category_id: category!.id, serial_number: 2, status: "sold", owner_user_id: seller!.id },
      ])
      .select("id")
      .returns<Array<{ id: string }>>();

    const { data: purchase } = await client
      .from("purchases")
      .insert({
        buyer_user_id: buyer!.id,
        event_id: event!.id,
        ticket_id: tickets![0].id,
        amount: 10,
        currency: "EUR",
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select("id, organization_id")
      .single<{ id: string; organization_id: string | null }>();
    expect(purchase?.organization_id).toBe(organizationId);

    const { data: customer } = await client
      .from("organization_customers")
      .select("organization_id, user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", buyer!.id)
      .single<{ organization_id: string; user_id: string }>();
    expect(customer?.organization_id).toBe(organizationId);

    const { data: listing } = await client
      .from("resale_listings")
      .insert({
        ticket_id: tickets![1].id,
        seller_user_id: seller!.id,
        price: 12,
        currency: "EUR",
        status: "active",
      })
      .select("id, organization_id")
      .single<{ id: string; organization_id: string | null }>();
    expect(listing?.organization_id).toBe(organizationId);

    const { data: redemption } = await client
      .from("ticket_redemptions")
      .insert({
        ticket_id: tickets![1].id,
        event_id: event!.id,
        controller_user_id: controller!.id,
        evm_address: "0xorganizationtrigger",
        result: "valid",
      })
      .select("id, organization_id")
      .single<{ id: string; organization_id: string | null }>();
    expect(redemption?.organization_id).toBe(organizationId);

    await client.from("ticket_redemptions").delete().eq("id", redemption!.id);
    await client.from("resale_listings").delete().eq("id", listing!.id);
    await client.from("purchases").delete().eq("id", purchase!.id);
    await client.from("tickets").delete().eq("event_id", event!.id);
    await client.from("ticket_categories").delete().eq("event_id", event!.id);
    await client.from("events").delete().eq("id", event!.id);
  });
});
