import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { ApiRouteError } from "@/lib/api/errors";
import {
  MadCheckoutBlockedError,
  SellerNotPayoutReadyError,
  SellerRiskBlockedError,
  StripeMarketplaceError,
  WebhookSignatureError,
} from "../errors";

describe("StripeMarketplaceError hierarchy", () => {
  it("all subclasses are ApiRouteError instances", () => {
    assert.ok(new MadCheckoutBlockedError() instanceof ApiRouteError);
    assert.ok(new SellerNotPayoutReadyError() instanceof ApiRouteError);
    assert.ok(new SellerRiskBlockedError() instanceof ApiRouteError);
    assert.ok(new WebhookSignatureError() instanceof ApiRouteError);
    assert.ok(new StripeMarketplaceError("x") instanceof ApiRouteError);
  });

  it("MadCheckoutBlockedError carries 400 + plan-mandated copy", () => {
    const err = new MadCheckoutBlockedError();
    assert.equal(err.status, 400);
    assert.equal(err.message, "MAD payments are not available yet.");
  });

  it("SellerRiskBlockedError carries 409 (conflict, not a 4xx auth fail)", () => {
    const err = new SellerRiskBlockedError();
    assert.equal(err.status, 409);
  });

  it("WebhookSignatureError is 400 (Stripe will not retry)", () => {
    const err = new WebhookSignatureError();
    assert.equal(err.status, 400);
  });

  it("SellerNotPayoutReadyError accepts a custom detail", () => {
    const err = new SellerNotPayoutReadyError("Organizer payouts disabled.");
    assert.equal(err.message, "Organizer payouts disabled.");
    assert.equal(err.status, 409);
  });
});
