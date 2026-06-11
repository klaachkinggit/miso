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

async function profileIdByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Missing profile ${email}: ${error?.message}`);
  return data.id;
}

async function createOrganization(client: SupabaseClient, params: {
  name: string;
  slug: string;
  status?: "active" | "suspended";
}): Promise<string> {
  const { data, error } = await client
    .from("organizations")
    .insert({
      name: params.name,
      slug: params.slug,
      status: params.status ?? "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Organization seed failed: ${error?.message}`);
  return data.id;
}

async function createPublishedEvent(client: SupabaseClient, params: {
  organizationId: string;
  name: string;
  slug: string;
}): Promise<string> {
  const { data, error } = await client
    .from("events")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      slug: params.slug,
      date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      venue_name: "Storefront Test Hall",
      city: "Paris",
      capacity: 100,
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: true,
      status: "published",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Event seed failed: ${error?.message}`);
  return data.id;
}

async function createCategory(client: SupabaseClient, eventId: string): Promise<string> {
  const { data, error } = await client
    .from("ticket_categories")
    .insert({
      event_id: eventId,
      name: "General admission",
      price: 20,
      currency: "EUR",
      supply: 10,
      sales_enabled: true,
      resale_enabled: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Category seed failed: ${error?.message}`);
  return data.id;
}

async function createListingFixture(client: SupabaseClient, params: {
  eventId: string;
  categoryId: string;
  sellerId: string;
  organizationId: string;
}): Promise<{ ticketId: string; listingId: string }> {
  const { data: ticket, error: ticketError } = await client
    .from("tickets")
    .insert({
      event_id: params.eventId,
      category_id: params.categoryId,
      serial_number: 1,
      status: "sold",
      owner_user_id: params.sellerId,
      nft_contract_address: "0x1111111111111111111111111111111111111111",
      nft_token_id: Date.now() & 0xffff,
      owner_evm_address: "0x2222222222222222222222222222222222222222",
    })
    .select("id")
    .single<{ id: string }>();
  if (ticketError || !ticket) throw new Error(`Ticket seed failed: ${ticketError?.message}`);

  const { data: listing, error: listingError } = await client
    .from("resale_listings")
    .insert({
      ticket_id: ticket.id,
      seller_user_id: params.sellerId,
      organization_id: params.organizationId,
      price: 24,
      currency: "EUR",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (listingError || !listing) throw new Error(`Listing seed failed: ${listingError?.message}`);

  const { error: updateError } = await client
    .from("tickets")
    .update({ status: "listed", current_listing_id: listing.id })
    .eq("id", ticket.id);
  if (updateError) throw new Error(`Ticket listing update failed: ${updateError.message}`);

  return { ticketId: ticket.id, listingId: listing.id };
}

test.describe("Organization public storefront", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("scopes event pages and marketplace listings to one organization", async ({ page }) => {
    const client = serviceSb();
    const stamp = Date.now().toString(36);
    const orgASlug = `store-alpha-${stamp}`;
    const orgBSlug = `store-beta-${stamp}`;
    const inactiveSlug = `store-inactive-${stamp}`;
    const ids = {
      organizations: [] as string[],
      events: [] as string[],
      categories: [] as string[],
      tickets: [] as string[],
      listings: [] as string[],
    };

    try {
      const sellerId = await profileIdByEmail(client, "seller@miso.local");
      const orgA = await createOrganization(client, { name: "Store Alpha", slug: orgASlug });
      const orgB = await createOrganization(client, { name: "Store Beta", slug: orgBSlug });
      const inactive = await createOrganization(client, {
        name: "Store Inactive",
        slug: inactiveSlug,
        status: "suspended",
      });
      ids.organizations.push(orgA, orgB, inactive);

      const eventA = await createPublishedEvent(client, {
        organizationId: orgA,
        name: "Alpha Scoped Night",
        slug: "shared-drop",
      });
      const eventB = await createPublishedEvent(client, {
        organizationId: orgB,
        name: "Beta Scoped Night",
        slug: "shared-drop",
      });
      const inactiveEvent = await createPublishedEvent(client, {
        organizationId: inactive,
        name: "Inactive Scoped Night",
        slug: "inactive-drop",
      });
      ids.events.push(eventA, eventB, inactiveEvent);

      const categoryA = await createCategory(client, eventA);
      const categoryB = await createCategory(client, eventB);
      const inactiveCategory = await createCategory(client, inactiveEvent);
      ids.categories.push(categoryA, categoryB, inactiveCategory);

      const listingA = await createListingFixture(client, {
        eventId: eventA,
        categoryId: categoryA,
        sellerId,
        organizationId: orgA,
      });
      const listingB = await createListingFixture(client, {
        eventId: eventB,
        categoryId: categoryB,
        sellerId,
        organizationId: orgB,
      });
      const inactiveListing = await createListingFixture(client, {
        eventId: inactiveEvent,
        categoryId: inactiveCategory,
        sellerId,
        organizationId: inactive,
      });
      ids.tickets.push(listingA.ticketId, listingB.ticketId, inactiveListing.ticketId);
      ids.listings.push(listingA.listingId, listingB.listingId, inactiveListing.listingId);

      await page.goto(`/s/${orgASlug}`);
      await expect(page.getByRole("heading", { name: "Store Alpha" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Alpha Scoped Night/i })).toBeVisible();
      await expect(page.getByText("Beta Scoped Night")).toHaveCount(0);

      if ((process.env.MISO_STOREFRONT_ROOT_DOMAINS ?? "").split(",").includes("localhost")) {
        const port = process.env.PLAYWRIGHT_PORT ?? "3002";
        await page.goto(`http://${orgASlug}.localhost:${port}/`);
        await expect(page.getByRole("heading", { name: "Store Alpha" })).toBeVisible();
        await page.getByRole("link", { name: /Alpha Scoped Night/i }).first().click();
        await expect(page).toHaveURL(new RegExp(`^http://${orgASlug}\\.localhost:${port}/events/shared-drop`));
        await expect(page.getByRole("heading", { name: "Alpha Scoped Night" })).toBeVisible();
      }

      await page.goto(`/s/${orgASlug}/events/shared-drop`);
      await expect(page.getByRole("heading", { name: "Alpha Scoped Night" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Tickets/i })).toBeVisible();

      await page.goto(`/s/${orgBSlug}/events/shared-drop`);
      await expect(page.getByRole("heading", { name: "Beta Scoped Night" })).toBeVisible();

      await page.goto(`/s/${orgASlug}/marketplace`);
      await expect(page.getByRole("heading", { name: "Store Alpha exchange" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Alpha Scoped Night/i })).toBeVisible();
      await expect(page.getByText("Beta Scoped Night")).toHaveCount(0);

      await page.goto(`/s/${orgASlug}/marketplace/${listingA.listingId}`);
      await expect(page.getByRole("heading", { name: "Alpha Scoped Night" })).toBeVisible();
      await expect(page.getByRole("button", { name: /buy ticket/i })).toBeVisible();

      await page.goto("/events");
      await expect(page.getByText("Inactive Scoped Night")).toHaveCount(0);

      await page.goto("/marketplace");
      await expect(page.getByText("Inactive Scoped Night")).toHaveCount(0);

      const inactiveResponse = await page.goto(`/s/${inactiveSlug}`);
      expect(inactiveResponse?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    } finally {
      if (ids.listings.length) await client.from("resale_listings").delete().in("id", ids.listings);
      if (ids.tickets.length) await client.from("tickets").delete().in("id", ids.tickets);
      if (ids.categories.length) await client.from("ticket_categories").delete().in("id", ids.categories);
      if (ids.events.length) await client.from("events").delete().in("id", ids.events);
      if (ids.organizations.length) await client.from("organizations").delete().in("id", ids.organizations);
    }
  });
});
