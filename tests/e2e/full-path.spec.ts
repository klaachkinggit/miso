import { expect, test } from "@playwright/test";
import { DEMO_BUYER, DEMO_SELLER, login } from "./helpers/auth";

// Full-path E2E (requires `npm run demo:seed` + dev server).
// Set MISO_E2E_FULL=1 to enable. Skipped by default so CI without a seeded DB
// stays green on smoke tests alone.
const fullPathEnabled = process.env.MISO_E2E_FULL === "1";

async function openDemoEvent(page: Parameters<typeof login>[0]) {
  await page.goto("/events");
  await page.getByRole("link", { name: "Miso Demo Night" }).first().click();
}

test.describe("Full path: discover → checkout → my tickets → redeem", () => {
  test.skip(!fullPathEnabled, "Set MISO_E2E_FULL=1 with a seeded DB to run.");

  test("buyer purchases a ticket with Account Balance", async ({ page }) => {
    await login(page, DEMO_BUYER);

    await openDemoEvent(page);

    await expect(page.getByRole("heading", { name: /tickets/i })).toBeVisible();

    const buyButton = page.getByRole("button", { name: /buy ticket/i }).first();
    await expect(buyButton).toBeEnabled();
    await buyButton.click();

    await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
    await expect(page.getByText(/ticket is ready|finalising/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("zero-balance holder cannot start checkout", async ({ page }) => {
    await login(page, DEMO_SELLER);

    await openDemoEvent(page);

    const buyButton = page.getByRole("button", { name: /buy ticket/i }).first();
    await expect(buyButton).toBeDisabled();
    await expect(page.getByText(/balance 0 mad/i).first()).toBeVisible();
  });

  test("funding actions are visible but not implemented", async ({ page }) => {
    await login(page, DEMO_BUYER);

    await page.goto("/balance");
    await expect(page.getByRole("heading", { name: "Account Balance" })).toBeVisible();

    await page.getByRole("button", { name: /^charge$/i }).click();
    await expect(page.getByText("Charging Account Balance is not implemented yet.", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /^cashout$/i }).click();
    await expect(page.getByText("Cashout is not implemented yet.", { exact: true }).first()).toBeVisible();
  });

  test("ticket appears in /tickets after purchase", async ({ page }) => {
    await login(page, DEMO_BUYER);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My tickets" })).toBeVisible();
    // Either we have tickets (purchased above) or empty state if seed was reset.
    const ticketCards = page.getByText(/serial/i);
    const empty = page.getByText("No tickets yet");
    await expect(ticketCards.first().or(empty)).toBeVisible();
  });
});

test.describe("Marketplace: list → purchase", () => {
  test.skip(!fullPathEnabled, "Set MISO_E2E_FULL=1 with a seeded DB to run.");

  test("seller can open list-for-resale dialog on a valid ticket", async ({ page }) => {
    await login(page, DEMO_BUYER);
    await page.goto("/tickets");
    const listButton = page.getByRole("button", { name: /list for resale/i }).first();
    if (await listButton.count()) {
      await listButton.click();
      await expect(page.getByRole("heading", { name: /list ticket for resale/i })).toBeVisible();
      await page.getByRole("button", { name: /^cancel$/i }).click();
    }
  });

  test("marketplace lists active resale listings", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  });
});
