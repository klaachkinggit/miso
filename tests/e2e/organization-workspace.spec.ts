import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./helpers/env";
import { login } from "./helpers/auth";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";
const ACTIVE_ORGANIZATION_COOKIE = "miso_active_organization_id";
const WORKSPACE_ADMIN = {
  email: "org-workspace-admin@miso.local",
  password: "misoworkspaceadmin",
};

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureWorkspaceAdmin(client: SupabaseClient): Promise<string> {
  const { data: existing } = await client
    .from("profiles")
    .select("id")
    .eq("email", WORKSPACE_ADMIN.email)
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    await client.auth.admin.updateUserById(existing.id, {
      password: WORKSPACE_ADMIN.password,
      email_confirm: true,
    });
    await client.from("profiles").upsert({
      id: existing.id,
      email: WORKSPACE_ADMIN.email,
      display_name: "Org Workspace Admin",
      role: "user",
    });
    return existing.id;
  }

  const created = await client.auth.admin.createUser({
    email: WORKSPACE_ADMIN.email,
    password: WORKSPACE_ADMIN.password,
    email_confirm: true,
    user_metadata: { full_name: "Org Workspace Admin" },
  });
  const userId = created.data.user!.id;
  await client.from("profiles").upsert({
    id: userId,
    email: WORKSPACE_ADMIN.email,
    display_name: "Org Workspace Admin",
    role: "user",
  });
  return userId;
}

async function createOrganizationFixture(
  client: SupabaseClient,
  params: { userId: string; name: string; slug: string },
): Promise<{ id: string; name: string }> {
  const { data: organization } = await client
    .from("organizations")
    .insert({
      name: params.name,
      slug: params.slug,
      created_by_user_id: params.userId,
    })
    .select("id, name")
    .single<{ id: string; name: string }>();
  expect(organization).toBeTruthy();

  await client.from("organization_memberships").insert({
    organization_id: organization!.id,
    user_id: params.userId,
    role: "admin",
  });
  return organization!;
}

async function createEventFixture(
  client: SupabaseClient,
  params: { organizationId: string; userId: string; name: string },
): Promise<string> {
  const { data: event } = await client
    .from("events")
    .insert({
      name: params.name,
      date: new Date(Date.now() + 86_400_000).toISOString(),
      venue_name: "Workspace Venue",
      city: "Paris",
      capacity: 100,
      status: "draft",
      organization_id: params.organizationId,
      organizer_user_id: params.userId,
      slug: `${params.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
    })
    .select("id")
    .single<{ id: string }>();
  expect(event).toBeTruthy();
  return event!.id;
}

async function cleanup(client: SupabaseClient, organizationIds: string[]) {
  if (!organizationIds.length) return;
  await client.from("events").delete().in("organization_id", organizationIds);
  await client.from("organization_memberships").delete().in("organization_id", organizationIds);
  await client.from("organizations").delete().in("id", organizationIds);
}

test.describe("Organization workspace selection", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("admin switches organizations and creates events in the selected workspace", async ({ page }) => {
    const client = sb();
    const userId = await ensureWorkspaceAdmin(client);
    const stamp = Date.now().toString(36);
    const createdOrgIds: string[] = [];

    try {
      const orgA = await createOrganizationFixture(client, {
        userId,
        name: `Workspace Alpha ${stamp}`,
        slug: `workspace-alpha-${stamp}`,
      });
      createdOrgIds.push(orgA.id);
      const orgB = await createOrganizationFixture(client, {
        userId,
        name: `Workspace Beta ${stamp}`,
        slug: `workspace-beta-${stamp}`,
      });
      createdOrgIds.push(orgB.id);
      const orgC = await createOrganizationFixture(client, {
        userId,
        name: `Workspace Outsider ${stamp}`,
        slug: `workspace-outsider-${stamp}`,
      });
      createdOrgIds.push(orgC.id);
      await client
        .from("organization_memberships")
        .delete()
        .eq("organization_id", orgC.id)
        .eq("user_id", userId);

      const eventAName = `Alpha Event ${stamp}`;
      const eventBName = `Beta Event ${stamp}`;
      await createEventFixture(client, { organizationId: orgA.id, userId, name: eventAName });
      await createEventFixture(client, { organizationId: orgB.id, userId, name: eventBName });

      await login(page, WORKSPACE_ADMIN);
      await page.goto("/admin/events");
      await expect(page.getByText(eventAName)).toBeVisible();
      await expect(page.getByText(eventBName)).toHaveCount(0);

      await page.getByLabel("Active organization").selectOption(orgB.id);
      await page.getByRole("button", { name: "Switch organization" }).click();
      await page.waitForURL((url) => url.pathname === "/admin");
      await page.goto("/admin/events");
      await expect(page.getByText(eventBName)).toBeVisible();
      await expect(page.getByText(eventAName)).toHaveCount(0);

      const tagline = `Raw ticket channel ${stamp}`;
      await page.goto("/admin/settings");
      await page.getByLabel("Storefront tagline").fill(tagline);
      await page.getByLabel("Accent color").fill("#33cc99");
      await page.getByRole("button", { name: /save branding/i }).click();
      await page.waitForURL(/\/admin\/settings\?success=/);
      await expect(page.getByText("Branding saved.")).toBeVisible();

      const { data: brandedOrg } = await client
        .from("organizations")
        .select("branding")
        .eq("id", orgB.id)
        .single<{ branding: { tagline?: string; accent_color?: string } }>();
      expect(brandedOrg?.branding).toMatchObject({
        tagline,
        accent_color: "#33cc99",
      });
      await page.goto(`/s/workspace-beta-${stamp}`);
      await expect(page.getByRole("heading", { name: `Workspace Beta ${stamp}` })).toBeVisible();
      await expect(page.getByText(tagline)).toBeVisible();

      await page.goto("/admin/settings");
      await page.getByText("Activate royalty").click();
      await page.getByLabel("Royalty rate").fill("750");
      await page.getByRole("button", { name: /save royalty settings/i }).click();
      await page.waitForURL(/\/admin\/settings\?success=/);
      await expect(page.getByText("Royalty settings saved.")).toBeVisible();

      const { data: royaltyOrg } = await client
        .from("organizations")
        .select("resale_royalty_enabled, resale_royalty_bps")
        .eq("id", orgB.id)
        .single<{ resale_royalty_enabled: boolean; resale_royalty_bps: number }>();
      expect(royaltyOrg).toMatchObject({
        resale_royalty_enabled: true,
        resale_royalty_bps: 750,
      });

      const createdEventName = `Selected Org Draft ${stamp}`;
      await page.goto("/admin/events/new");
      await page.getByLabel("Name", { exact: true }).fill(createdEventName);
      await page.getByLabel("Date", { exact: true }).fill("2030-06-01T22:00");
      await page.getByLabel("Capacity", { exact: true }).fill("200");
      await page.getByLabel("Venue", { exact: true }).fill("Workspace Venue");
      await page.getByLabel("City", { exact: true }).fill("Paris");
      await page.getByRole("button", { name: /create event/i }).click();
      await page.waitForURL(/\/admin\/events\/[0-9a-f-]+/, { timeout: 20_000 });

      const { data: createdEvent } = await client
        .from("events")
        .select("organization_id")
        .eq("name", createdEventName)
        .single<{ organization_id: string | null }>();
      expect(createdEvent?.organization_id).toBe(orgB.id);

      await page.context().addCookies([
        {
          name: ACTIVE_ORGANIZATION_COOKIE,
          value: orgC.id,
          url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/admin/events");
      await expect(page.getByText(`Workspace Outsider ${stamp}`)).toHaveCount(0);
      await expect(page.getByText(eventAName).or(page.getByText(eventBName))).toBeVisible();
    } finally {
      await cleanup(client, createdOrgIds);
    }
  });
});
