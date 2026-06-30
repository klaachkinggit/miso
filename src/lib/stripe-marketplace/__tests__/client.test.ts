import { afterEach, describe, expect, it, vi } from "vitest";
import { resetStripeEnvCacheForTest, stripeEnv } from "../client";

afterEach(() => {
  resetStripeEnvCacheForTest();
  vi.unstubAllEnvs();
});

describe("stripeEnv", () => {
  it("accepts restricted API keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_12345678901234567890");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1234567890");

    expect(stripeEnv().STRIPE_SECRET_KEY).toBe("rk_test_12345678901234567890");
  });

  it("rejects unrestricted secret keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_12345678901234567890");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1234567890");

    expect(() => stripeEnv()).toThrow("STRIPE_SECRET_KEY");
  });
});
