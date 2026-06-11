import { ApiRouteError } from "@/lib/api/errors";

// Module-local error subtypes. They extend ApiRouteError so the global
// apiErrorResponse() / passthrough pipeline keeps working unchanged.

export class StripeMarketplaceError extends ApiRouteError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = "StripeMarketplaceError";
  }
}

export class MadCheckoutBlockedError extends StripeMarketplaceError {
  constructor() {
    super("MAD payments are not available yet.", 400);
    this.name = "MadCheckoutBlockedError";
  }
}

export class SellerNotPayoutReadyError extends StripeMarketplaceError {
  constructor(detail = "Seller is not payout-ready.") {
    super(detail, 409);
    this.name = "SellerNotPayoutReadyError";
  }
}

export class SellerRiskBlockedError extends StripeMarketplaceError {
  constructor() {
    super("Seller cannot publish paid inventory at this time.", 409);
    this.name = "SellerRiskBlockedError";
  }
}

export class WebhookSignatureError extends StripeMarketplaceError {
  constructor() {
    super("Invalid Stripe webhook signature.", 400);
    this.name = "WebhookSignatureError";
  }
}
