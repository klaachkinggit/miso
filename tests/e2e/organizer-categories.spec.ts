import { expect, test } from "@playwright/test";
import { DEMO_ORGANIZER, login } from "./helpers/auth";

// Organizer flow: create a draft event then add standard + club_table
// categories with different configurations. Each `createCategory` call
// hits the DB constraint that requires `min_spending IS NOT NULL` for
// club_table — these tests guard against regressions on that contract.
//
// Gated on MISO_E2E_FULL=1 + a seeded demo organizer because the test
// inserts real rows. Skipped by default so smoke runs stay hermetic.
const fullPathEnabled = process.env.MISO_E2E_FULL === "1";

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

async function createDraftEvent(
  page: Parameters<typeof login>[0],
  name: string,
): Promise<string> {
  await page.goto("/admin/events/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  // datetime-local; a fixed future time is enough.
  await page.getByLabel("Date", { exact: true }).fill("2030-06-01T22:00");
  await page.getByLabel("Capacity", { exact: true }).fill("200");
  await page.getByLabel("Venue", { exact: true }).fill("Test Venue");
  await page.getByLabel("City", { exact: true }).fill("Paris");
  await page.getByRole("button", { name: /create event/i }).click();
  await page.waitForURL(/\/admin\/events\/[0-9a-f-]+/, { timeout: 20_000 });
  const match = page.url().match(/\/admin\/events\/([0-9a-f-]+)/);
  if (!match)
    throw new Error("Event creation did not redirect to admin event page");
  await page.getByRole("tab", { name: "Categories" }).click();
  return match[1]!;
}

test.describe("Organizer category creation", () => {
  test.skip(
    !fullPathEnabled,
    "Set MISO_E2E_FULL=1 with a seeded organizer to run.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_ORGANIZER);
  });

  test("creates a standard category and seeds its tickets", async ({
    page,
  }) => {
    const eventName = uniqueName("E2E Std");
    await createDraftEvent(page, eventName);

    await page.getByLabel("Category type").selectOption("standard");
    await page.getByLabel("Name").fill("General Admission");
    await page.getByLabel("Price").fill("25");
    await page.getByLabel("Supply").fill("5");
    await page
      .getByRole("button", { name: /create and seed tickets/i })
      .click();

    await expect(page).not.toHaveURL(/error=/);
    await expect(page.getByText("General Admission")).toBeVisible();
  });

  test("creates a club_table category (price doubles as min spending)", async ({
    page,
  }) => {
    const eventName = uniqueName("E2E Club");
    await createDraftEvent(page, eventName);

    await page.getByLabel("Category type").selectOption("club_table");
    await page.getByLabel("Name").fill("Gold Table");
    await page.getByLabel(/table price/i).fill("600");
    await page.getByLabel("Supply").fill("3");
    await page.getByLabel("Online advance").fill("150");
    await page.getByLabel("Base guests included").fill("4");
    await page
      .getByRole("button", { name: /create and seed tickets/i })
      .click();

    await expect(page).not.toHaveURL(/error=/);
    await expect(page.getByText("Gold Table")).toBeVisible();
  });

  test("creates a club_table with extra guests enabled", async ({ page }) => {
    const eventName = uniqueName("E2E Club Extras");
    await createDraftEvent(page, eventName);

    await page.getByLabel("Category type").selectOption("club_table");
    await page.getByLabel("Name").fill("Skyline Table");
    await page.getByLabel(/table price/i).fill("800");
    await page.getByLabel("Supply").fill("2");
    await page.getByLabel("Online advance").fill("200");
    await page.getByLabel("Base guests included").fill("4");
    await page.getByLabel(/allow extra guests beyond base capacity/i).check();
    await page.getByLabel("Price per extra guest").fill("40");
    await page.getByLabel("Max extra guests").fill("4");
    await page
      .getByRole("button", { name: /create and seed tickets/i })
      .click();

    await expect(page).not.toHaveURL(/error=/);
    await expect(page.getByText("Skyline Table")).toBeVisible();
  });

  test("rejects club_table missing required fields before submission", async ({
    page,
  }) => {
    const eventName = uniqueName("E2E Club Invalid");
    await createDraftEvent(page, eventName);

    await page.getByLabel("Category type").selectOption("club_table");
    await page.getByLabel("Name").fill("Bad Table");
    await page.getByLabel(/table price/i).fill("500");
    await page.getByLabel("Supply").fill("1");
    // Intentionally clear Online advance / base capacity to trip refine.
    await page.getByLabel("Online advance").fill("");
    await page.getByLabel("Base guests included").fill("");
    await page
      .getByRole("button", { name: /create and seed tickets/i })
      .click();

    await expect(page.getByLabel("Online advance")).toBeFocused();
    await expect
      .poll(() =>
        page
          .getByLabel("Online advance")
          .evaluate((input) => (input as HTMLInputElement).validationMessage),
      )
      .not.toBe("");
  });
});
