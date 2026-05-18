import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (c: unknown[]) => void } }) => {
    // Mimic supabase-ssr: returns object with auth.getUser
    return {
      auth: { getUser: getUserMock },
      __cookieAdapter: opts.cookies,
    };
  },
}));

import { updateSession } from "@/lib/supabase/middleware";

function buildRequest(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest("http://localhost:3000/", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

function setCookieNames(response: { headers: Headers }): string[] {
  return response.headers.getSetCookie().map((entry) => entry.split("=")[0]!.trim());
}

describe("middleware updateSession — stale refresh-token recovery", () => {
  it("clears sb-* cookies when supabase reports an auth error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Refresh token is not valid" },
    });
    const req = buildRequest({
      "sb-127-auth-token": "garbage",
      "sb-refresh-token": "stale",
      "other-cookie": "keep-me",
    });
    const { response, user } = await updateSession(req);
    expect(user).toBeNull();
    const names = setCookieNames(response);
    expect(names).toContain("sb-127-auth-token");
    expect(names).toContain("sb-refresh-token");
    expect(names).not.toContain("other-cookie");
  });

  it("clears sb-* cookies when supabase throws (raw AuthApiError)", async () => {
    getUserMock.mockRejectedValue(
      Object.assign(new Error("Refresh token is not valid"), { name: "AuthApiError" }),
    );
    const req = buildRequest({ "sb-127-auth-token": "garbage" });
    const { response, user } = await updateSession(req);
    expect(user).toBeNull();
    expect(setCookieNames(response)).toContain("sb-127-auth-token");
  });

  it("does not delete cookies when user is authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u-1", email: "a@b.test" } },
      error: null,
    });
    const req = buildRequest({ "sb-127-auth-token": "valid" });
    const { response, user } = await updateSession(req);
    expect(user).toEqual({ id: "u-1", email: "a@b.test" });
    // No Set-Cookie deletions emitted by our error branch
    expect(setCookieNames(response)).not.toContain("sb-127-auth-token");
  });

  it("is a no-op for requests with no sb-* cookies on auth error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Refresh token is not valid" },
    });
    const req = buildRequest({ analytics: "yes" });
    const { response, user } = await updateSession(req);
    expect(user).toBeNull();
    expect(setCookieNames(response)).toEqual([]);
  });
});
