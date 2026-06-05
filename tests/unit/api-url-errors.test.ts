import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  ApiRouteError,
  DomainError,
  apiErrorResponse,
} from "@/lib/api/errors";
import { getRequestOrigin } from "@/lib/url";

const originalEnv = { ...process.env };

function request(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

describe("getRequestOrigin", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses canonical APP_URL for non-local requests and strips trailing slashes", () => {
    process.env.APP_URL = "https://miso.example.com///";

    expect(getRequestOrigin(request("https://attacker.example/checkout"))).toBe("https://miso.example.com");
  });

  it("honors forwarded hosts only when allowlisted", () => {
    process.env.APP_URL = "";
    process.env.TRUSTED_FORWARDED_HOSTS = "miso.example.com";

    expect(
      getRequestOrigin(
        request("https://internal.example/checkout", {
          "x-forwarded-host": "miso.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://miso.example.com");
    expect(
      getRequestOrigin(
        request("https://internal.example/checkout", {
          "x-forwarded-host": "evil.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://internal.example");
  });

  it("keeps localhost origins usable even when APP_URL is set", () => {
    process.env.APP_URL = "https://miso.example.com";

    expect(getRequestOrigin(request("http://localhost:3002/checkout"))).toBe("http://localhost:3002");
  });

  it("keeps trusted organization storefront origins for checkout redirects", () => {
    process.env.APP_URL = "https://app.miso.com";

    expect(getRequestOrigin(request("https://boilerroom.miso.com/api/checkout"))).toBe(
      "https://boilerroom.miso.com",
    );
  });
});

describe("API error response safety", () => {
  it("returns explicit API route errors with their status", async () => {
    const response = apiErrorResponse(new ApiRouteError("Authentication required.", 401));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("exposes domain errors but suppresses generic internals", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const domain = apiErrorResponse(new DomainError("Ticket category is not accepted at this gate"));
    const generic = apiErrorResponse(new Error("database column leaked"), { fallback: "Checkout failed." });

    expect(domain.status).toBe(400);
    await expect(domain.json()).resolves.toEqual({
      error: "Ticket category is not accepted at this gate",
    });
    expect(generic.status).toBe(400);
    await expect(generic.json()).resolves.toEqual({ error: "Checkout failed." });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("suppresses generic error internals when no domain marker is present", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabaseErr = {
      code: "23514",
      message: 'new row for relation "ticket_categories" violates check constraint',
      details: "Failing row contains (...)",
      hint: null,
    };
    const response = apiErrorResponse(supabaseErr, { fallback: "Category could not be created." });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Category could not be created." });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
