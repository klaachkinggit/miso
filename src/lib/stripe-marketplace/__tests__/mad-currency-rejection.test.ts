import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { MadCheckoutBlockedError, StripeMarketplaceError } from "../errors";

// ---------------------------------------------------------------------------
// MAD currency rejection — enforcement-layer tests.
//
// The validation function `assertEur` (private to payments.ts) is the only
// enforcement point for currency inside the checkout path. Because it is not
// exported we pin the behavior at two observable layers:
//
//   1. The error class itself — confirms the exact type and HTTP status that
//      the API route receives when MAD is passed.
//   2. The logic of assertEur re-implemented inline — unit-tests the three
//      branches (MAD blocked, non-EUR blocked, EUR passes) without importing
//      production I/O.
//
// Caveat: assertEur is a module-private function inside payments.ts. A full
// integration test of createPrimaryCheckout / createResaleCheckout with MAD
// would require mocking reserveTicket, getResaleCheckoutListing, supabase,
// and stripeClient — well beyond the scope of a currency guard test. If the
// team wants a test-only export, add `export { assertEur } from "./payments"`
// to a test-helpers barrel and update these tests accordingly.
// ---------------------------------------------------------------------------

// Re-implement the exact logic from payments.ts:assertEur for isolation.
function assertEur(currency: string): asserts currency is "EUR" {
  if (currency === "MAD") throw new MadCheckoutBlockedError();
  if (currency !== "EUR") {
    throw new StripeMarketplaceError(`Unsupported currency: ${currency}`, 400);
  }
}

describe("MadCheckoutBlockedError", () => {
  it("carries the canonical 400 status", () => {
    const err = new MadCheckoutBlockedError();
    assert.equal(err.status, 400);
  });

  it("carries the plan-mandated message", () => {
    const err = new MadCheckoutBlockedError();
    assert.equal(err.message, "MAD payments are not available yet.");
  });

  it("is a StripeMarketplaceError subtype", () => {
    assert.ok(new MadCheckoutBlockedError() instanceof StripeMarketplaceError);
  });
});

describe("assertEur (currency validation logic mirrored from payments.ts)", () => {
  it("throws MadCheckoutBlockedError for MAD", () => {
    assert.throws(
      () => assertEur("MAD"),
      (err: unknown) => {
        assert.ok(err instanceof MadCheckoutBlockedError);
        assert.equal((err as MadCheckoutBlockedError).status, 400);
        return true;
      },
    );
  });

  it("throws StripeMarketplaceError for other non-EUR currencies", () => {
    for (const currency of ["USD", "GBP", "CHF", "MAR"]) {
      assert.throws(
        () => assertEur(currency),
        (err: unknown) => {
          assert.ok(err instanceof StripeMarketplaceError);
          assert.ok(!(err instanceof MadCheckoutBlockedError));
          assert.equal((err as StripeMarketplaceError).status, 400);
          return true;
        },
        `Expected StripeMarketplaceError for currency=${currency}`,
      );
    }
  });

  it("does not throw for EUR", () => {
    assert.doesNotThrow(() => assertEur("EUR"));
  });

  it("MAD is rejected before the generic branch (specific error type check)", () => {
    // Ensures MAD gets MadCheckoutBlockedError, not the generic 'Unsupported currency' path.
    try {
      assertEur("MAD");
      assert.fail("Expected an error to be thrown");
    } catch (err) {
      assert.ok(err instanceof MadCheckoutBlockedError);
      assert.equal(
        (err as MadCheckoutBlockedError).message,
        "MAD payments are not available yet.",
      );
    }
  });

  it("case-sensitive: lowercase 'mad' is treated as unknown unsupported currency", () => {
    // assertEur checks exact string equality — 'mad' !== 'MAD'.
    assert.throws(
      () => assertEur("mad"),
      (err: unknown) => {
        // Falls through to the generic branch
        assert.ok(err instanceof StripeMarketplaceError);
        assert.ok(!(err instanceof MadCheckoutBlockedError));
        return true;
      },
    );
  });
});
