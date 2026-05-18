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

  test("POST /api/tickets/transfer-to-wallet rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/tickets/transfer-to-wallet", {
      data: {
        ticket_id: "00000000-0000-0000-0000-000000000000",
        destination_address: "0x0000000000000000000000000000000000000001",
      },
    });
    expect(res.status()).toBe(401);
  });
});
