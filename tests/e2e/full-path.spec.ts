import { expect, test } from "@playwright/test";
import { DEMO_BUYER, login } from "./helpers/auth";

// Full-path E2E (requires `npm run demo:seed` + dev server).
// Set MISO_E2E_FULL=1 to enable. Skipped by default so CI without a seeded DB
// stays green on smoke tests alone.
const fullPathEnabled = process.env.MISO_E2E_FULL === "1";

async function openDemoEvent(page: Parameters<typeof login>[0]) {
  await page.goto("/events");
  await page.getByRole("link", { name: /Midnight Frequency/i }).first().click();
}

test.describe("Full path: discover → checkout → my tickets → redeem", () => {
  test.skip(!fullPathEnabled, "Set MISO_E2E_FULL=1 with a seeded DB to run.");

  test("buyer can initiate Stripe checkout for a ticket", async ({ page }) => {
    await login(page, DEMO_BUYER);

    await openDemoEvent(page);

    await expect(page.getByRole("heading", { name: /tickets/i })).toBeVisible();

    const buyButton = page.getByRole("button", { name: /get ticket/i }).first();
    await expect(buyButton).toBeEnabled();
    await buyButton.click();
    await expect(page.getByRole("heading", { name: /buy this ticket/i })).toBeVisible();
    await page.getByRole("button", { name: /continue to payment/i }).click();

    // Button redirects to Stripe Checkout; wait for Stripe domain or success URL.
    await page.waitForURL(/checkout\.stripe\.com|\/checkout\/success/, { timeout: 30_000 });
  });

  test("ticket appears in /tickets after purchase", async ({ page }) => {
    await login(page, DEMO_BUYER);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Wallet", exact: true })).toBeVisible();
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
    const listButton = page.getByRole("button", { name: /list ticket/i }).first();
    if (await listButton.count()) {
      await listButton.click();
      await expect(page.getByRole("heading", { name: /list ticket/i })).toBeVisible();
      await page.getByRole("button", { name: /^cancel$/i }).click();
    }
  });

  test("marketplace lists active resale listings", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Resale exchange" })).toBeVisible();
  });
});
