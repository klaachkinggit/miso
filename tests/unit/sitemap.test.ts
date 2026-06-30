import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

describe("sitemap", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createClient.mockReset();
  });

  it("skips local Supabase during build-safe sitemap generation", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3002");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-service-role-key");

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(createClient).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.url)).toContain(
      "http://localhost:3002/events",
    );
  });
});
