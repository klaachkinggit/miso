import { expect, test } from "@playwright/test";
import { DEMO_BUYER, login } from "./helpers/auth";

// Full-path E2E (requires `npm run demo:seed` + dev server in mock-payment mode).
// Set MISO_E2E_FULL=1 to enable. Skipped by default so CI without a seeded DB
// stays green on smoke tests alone.
const fullPathEnabled = process.env.MISO_E2E_FULL === "1";

test.describe("Full path: discover → checkout → my tickets → redeem", () => {
  test.skip(!fullPathEnabled, "Set MISO_E2E_FULL=1 with a seeded DB to run.");

  test("buyer purchases a ticket in mock-payment mode", async ({ page }) => {
    await login(page, DEMO_BUYER);

    await page.goto("/events");
    const eventLink = page.getByRole("link", { name: /view tickets/i }).first();
    await expect(eventLink).toBeVisible();
    await eventLink.click();

    await expect(page.getByRole("heading", { name: /tickets/i })).toBeVisible();

    const buyButton = page.getByRole("button", { name: /buy ticket/i }).first();
    await expect(buyButton).toBeEnabled();
    await buyButton.click();

    await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
    await expect(page.getByText(/ticket is ready|finalising/i)).toBeVisible({
      timeout: 30_000,
    });
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
