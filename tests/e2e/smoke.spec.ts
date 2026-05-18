import { expect, test } from "@playwright/test";

test.describe("Public smoke", () => {
  test("home page renders hero + featured events section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Upcoming drops")).toBeVisible();
    await expect(page.getByRole("link", { name: /all events/i }).first()).toBeVisible();
  });

  test("events page lists at least one published event when seeded", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
    // Empty state OR at least one event card is acceptable when un-seeded.
    const eventCards = page.getByRole("link", { name: /open/i });
    const emptyState = page.getByText("No events yet");
    await expect(eventCards.first().or(emptyState)).toBeVisible();
  });

  test("home search and city links apply event discovery filters", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");

    await main.getByLabel("Search events").fill("paris");
    await main.getByRole("button", { name: "Explore" }).click();
    await expect(page).toHaveURL(/\/events\?q=paris/);
    await expect(page.getByText(/matching "paris"/)).toBeVisible();

    await page.goto("/");
    await main.getByRole("link", { name: "Paris", exact: true }).click();
    await expect(page).toHaveURL(/\/events\?city=paris/);
    await expect(page.getByText(/in paris/)).toBeVisible();
  });

  test("marketplace page renders, shows listings or empty state", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Resale exchange" })).toBeVisible();
    const listingCards = page.getByRole("link", { name: /^view$/i });
    const emptyState = page.getByText("No tickets listed right now");
    await expect(listingCards.first().or(emptyState)).toBeVisible();
  });

  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in to Miso" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });

  test("signup page renders form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  test("tickets requires auth (redirects to /login)", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin requires auth", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("controller requires auth", async ({ page }) => {
    await page.goto("/controller");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
