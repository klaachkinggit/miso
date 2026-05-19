import type { Page } from "@playwright/test";

export const DEMO_BUYER = {
  email: process.env.DEMO_BUYER_EMAIL ?? "buyer@miso.local",
  password: process.env.DEMO_BUYER_PASSWORD ?? "misobuyer",
};

export const DEMO_SELLER = {
  email: process.env.DEMO_SELLER_EMAIL ?? "seller@miso.local",
  password: process.env.DEMO_SELLER_PASSWORD ?? "misoseller",
};

export const DEMO_ORGANIZER = {
  email: process.env.DEMO_ORGANIZER_EMAIL ?? "organizer@miso.local",
  password: process.env.DEMO_ORGANIZER_PASSWORD ?? "misoorganizer",
};

export async function login(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 15_000 });
}
