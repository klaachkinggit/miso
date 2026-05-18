import { describe, expect, it } from "vitest";
import { classifyImageHost } from "@/lib/events/setup";

describe("classifyImageHost", () => {
  const localSupabase = "http://127.0.0.1:54321";

  it("allows local Supabase host in development", () => {
    const url = new URL("http://127.0.0.1:54321/storage/v1/object/public/event-images/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "development" }),
    ).toBe("local-supabase");
  });

  it("allows local Supabase host in test env", () => {
    const url = new URL("http://127.0.0.1:54321/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "test" }),
    ).toBe("local-supabase");
  });

  it("blocks local Supabase host in production (SSRF safeguard)", () => {
    const url = new URL("http://127.0.0.1:54321/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "production" }),
    ).toBe("blocked");
  });

  it("blocks 10/8 private host even in development", () => {
    const url = new URL("http://10.0.0.5/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "development" }),
    ).toBe("blocked");
  });

  it("blocks 192.168/16 private host", () => {
    const url = new URL("http://192.168.1.1/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "development" }),
    ).toBe("blocked");
  });

  it("blocks 169.254 link-local (AWS IMDS)", () => {
    const url = new URL("http://169.254.169.254/latest/meta-data/");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "production" }),
    ).toBe("blocked");
  });

  it("blocks `localhost` literal", () => {
    const url = new URL("http://localhost:54321/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: localSupabase, nodeEnv: "production" }),
    ).toBe("blocked");
  });

  it("flags public host as candidate (still needs DNS validation upstream)", () => {
    const url = new URL("https://cdn.example.com/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: "https://proj.supabase.co", nodeEnv: "production" }),
    ).toBe("public-candidate");
  });

  it("does not match local Supabase if env var hostname differs", () => {
    const url = new URL("http://127.0.0.1:54321/x.jpg");
    expect(
      classifyImageHost(url, {
        supabaseUrl: "https://proj.supabase.co",
        nodeEnv: "development",
      }),
    ).toBe("blocked");
  });

  it("handles malformed supabaseUrl by falling back to private-host check", () => {
    const url = new URL("http://127.0.0.1:54321/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: "not a url", nodeEnv: "development" }),
    ).toBe("blocked");
  });

  it("handles missing supabaseUrl by falling back to private-host check", () => {
    const url = new URL("http://127.0.0.1:54321/x.jpg");
    expect(
      classifyImageHost(url, { supabaseUrl: undefined, nodeEnv: "development" }),
    ).toBe("blocked");
  });
});
