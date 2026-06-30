import { describe, expect, it, vi } from "vitest";

let pathname: string | null = null;

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers(pathname == null ? {} : { "x-pathname": pathname }),
    ),
}));

import { isEmbedRequest } from "@/lib/embed/chrome";

describe("isEmbedRequest", () => {
  it("is true for the embed index", async () => {
    pathname = "/embed";
    expect(await isEmbedRequest()).toBe(true);
  });

  it("is true for an embed category route", async () => {
    pathname = "/embed/cat_123";
    expect(await isEmbedRequest()).toBe(true);
  });

  it("is false for a non-embed route", async () => {
    pathname = "/events";
    expect(await isEmbedRequest()).toBe(false);
  });

  it("is false when x-pathname is absent", async () => {
    pathname = null;
    expect(await isEmbedRequest()).toBe(false);
  });
});
