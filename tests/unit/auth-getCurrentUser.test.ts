import { afterEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({}),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { canUseBuyerSurface, getCurrentUser } from "@/lib/auth";

afterEach(() => {
  getUserMock.mockReset();
});

describe("getCurrentUser (refresh-token resilience)", () => {
  it("returns null when supabase returns an auth error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Refresh token is not valid" },
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when supabase throws (stale cookie crash)", async () => {
    getUserMock.mockRejectedValue(
      Object.assign(new Error("Refresh token is not valid"), { name: "AuthApiError" }),
    );
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when there is no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns the user when getUser succeeds", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.test" } },
      error: null,
    });
    await expect(getCurrentUser()).resolves.toEqual({ id: "user-1", email: "a@b.test" });
  });

  it("handles a user record without email", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", email: null } },
      error: null,
    });
    await expect(getCurrentUser()).resolves.toEqual({ id: "user-2", email: "" });
  });
});

describe("canUseBuyerSurface", () => {
  it("keeps controllers out of buyer surfaces", () => {
    expect(canUseBuyerSurface({ role: "controller" })).toBe(false);
  });

  it("allows anonymous and non-controller profiles into buyer surfaces", () => {
    expect(canUseBuyerSurface(null)).toBe(true);
    expect(canUseBuyerSurface({ role: "user" })).toBe(true);
    expect(canUseBuyerSurface({ role: "admin" })).toBe(true);
    expect(canUseBuyerSurface({ role: "organizer" })).toBe(true);
  });
});
