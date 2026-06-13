import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

// Spy on the Resend constructor so we can assert it is NEVER instantiated
// when RESEND_API_KEY is unset (a real no-op, not a swallowed error).
const resendCtor = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
    constructor(...args: unknown[]) {
      resendCtor(...args);
    }
  },
}));

// Lookup mock — toggled per test to throw and prove send-* swallows it.
const lookup = vi.hoisted(() => ({ throwOnSelect: false }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (lookup.throwOnSelect) throw new Error("profiles lookup blew up");
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    }),
  }),
}));

describe("sendTransactionalEmail (unconfigured)", () => {
  beforeEach(() => {
    resendCtor.mockClear();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.resetModules();
  });

  it("returns { sent: false }, does not throw, and never constructs Resend", async () => {
    const { sendTransactionalEmail } = await import("@/lib/email/client");
    const result = await sendTransactionalEmail({
      to: "buyer@example.com",
      subject: "hi",
      react: React.createElement("div"),
    });
    expect(result).toEqual({ sent: false });
    expect(resendCtor).not.toHaveBeenCalled();
  });

  it("getResend returns null when RESEND_API_KEY is unset", async () => {
    const { getResend } = await import("@/lib/email/client");
    expect(getResend()).toBeNull();
    expect(resendCtor).not.toHaveBeenCalled();
  });
});

describe("send-* helpers swallow errors", () => {
  afterEach(() => {
    lookup.throwOnSelect = false;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.restoreAllMocks();
  });

  it("does not reject when the recipient lookup throws", async () => {
    // Configure email so the helper proceeds past the env short-circuit and
    // reaches the (throwing) lookup — proving the try/catch swallows it.
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Miso <tickets@miso.example>";
    lookup.throwOnSelect = true;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendPurchaseReceipt } = await import("@/lib/email/send");
    await expect(
      sendPurchaseReceipt({
        buyerUserId: "user-1",
        eventName: "Test Event",
        category: "GA",
        quantity: 2,
        amount: "€50.00",
      }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });

  it("is a no-op (no lookup, no throw) when email is unconfigured", async () => {
    lookup.throwOnSelect = true; // would throw IF the lookup were reached
    const { sendRefundNotice } = await import("@/lib/email/send");
    await expect(
      sendRefundNotice({
        buyerUserId: "user-1",
        eventName: "Test Event",
        amount: "€10.00",
        reason: "event canceled",
      }),
    ).resolves.toBeUndefined();
  });
});
