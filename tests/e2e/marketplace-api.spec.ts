import { expect, test } from "@playwright/test";

// API-level checks for marketplace subsystem (no auth required, just shape).
test.describe("Marketplace API surface", () => {
  test("POST /api/marketplace/listings rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/marketplace/listings", {
      data: { ticket_id: "00000000-0000-0000-0000-000000000000", price: 100 },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/marketplace/checkout rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/marketplace/checkout", {
      data: { listing_id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });

  test("DELETE /api/marketplace/listings/[id] rejects unauthenticated", async ({ request }) => {
    const res = await request.delete(
      "/api/marketplace/listings/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/balance/charge rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/balance/charge");
    expect(res.status()).toBe(401);
  });

  test("POST /api/balance/cashout rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/balance/cashout");
    expect(res.status()).toBe(401);
  });
});
