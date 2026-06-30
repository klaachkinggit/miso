import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers the gift-recipient resolver shared by the marketplace primary
// checkout (the legacy createPurchaseCheckout that once owned this behaviour
// was retired in ADR 0003).

const dbState = vi.hoisted(() => ({
  friend: null as { id: string; email: string } | null,
  lookupEmail: null as string | null,
}));

class QueryMock {
  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    if (column === "email") dbState.lookupEmail = value as string;
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: dbState.friend, error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => new QueryMock(),
  }),
}));

describe("resolveGiftRecipientUserId", () => {
  beforeEach(() => {
    dbState.friend = null;
    dbState.lookupEmail = null;
  });

  it("returns null when no gift email is supplied", async () => {
    const { resolveGiftRecipientUserId } =
      await import("@/lib/payments/checkout");
    const sb = (await import("@/lib/supabase/service")).createServiceClient();
    expect(await resolveGiftRecipientUserId(sb, null)).toBeNull();
    expect(await resolveGiftRecipientUserId(sb, undefined)).toBeNull();
  });

  it("rejects unknown gift recipients", async () => {
    const { resolveGiftRecipientUserId, GiftRecipientNotFoundError } =
      await import("@/lib/payments/checkout");
    const sb = (await import("@/lib/supabase/service")).createServiceClient();
    const error = await resolveGiftRecipientUserId(
      sb,
      "ghost@example.com",
    ).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(GiftRecipientNotFoundError);
    expect(error).toHaveProperty(
      "message",
      "We could not find a MISO account for that gift recipient.",
    );
    expect(String((error as Error).message)).not.toContain("ghost@example.com");
  });

  it("normalizes the lookup email without exposing it in the error", async () => {
    const { resolveGiftRecipientUserId } =
      await import("@/lib/payments/checkout");
    const sb = (await import("@/lib/supabase/service")).createServiceClient();
    await expect(
      resolveGiftRecipientUserId(sb, "ghost@example.com"),
    ).rejects.toThrow("gift recipient");
    expect(dbState.lookupEmail).toBe("ghost@example.com");
  });

  it("resolves a registered recipient and lowercases the email lookup", async () => {
    dbState.friend = { id: "friend-1", email: "friend@example.com" };
    const { resolveGiftRecipientUserId } =
      await import("@/lib/payments/checkout");
    const sb = (await import("@/lib/supabase/service")).createServiceClient();
    const id = await resolveGiftRecipientUserId(sb, "FRIEND@EXAMPLE.COM");
    expect(id).toBe("friend-1");
    expect(dbState.lookupEmail).toBe("friend@example.com");
  });
});
