import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>(),
}));

describe("enforceRateLimit", () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });

  it("is a no-op (allowed) when Upstash is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    for (const bucket of [
      "checkout",
      "auth",
      "onboarding",
      "listing",
    ] as const) {
      const result = await enforceRateLimit(bucket, "id-1");
      expect(result.allowed).toBe(true);
    }
  });
});
