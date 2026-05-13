// PaymentProvider — interface for the mock provider used by the demo.

import type { Currency } from "@/types/db";

export interface CreateCheckoutInput {
  purchaseId: string;
  ticketId: string;
  buyerUserId: string;
  buyerEmail?: string;
  eventId: string;
  eventName: string;
  eventVenue: string;
  eventImage?: string | null;
  categoryName: string;
  amount: number;          // major units (e.g. 250.00)
  currency: Currency;
  successUrl: string;      // app URL the buyer returns to on success
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  // URL the front-end redirects the buyer to. For Mock this is the success URL
  // (buyer is "redirected" straight to success), for Payzone it's a hosted page.
  redirectUrl: string;
  providerSessionId: string;
}

export type WebhookEventKind =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.expired"
  | "refund.succeeded"
  | "refund.failed"
  | "ignored";

export interface ParsedWebhookEvent {
  // Unique provider event id used for idempotency.
  id: string;
  kind: WebhookEventKind;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  // The purchase the event refers to, when the provider stored it in metadata.
  purchaseId: string | null;
  raw: unknown;
}

export interface RefundInput {
  providerPaymentId: string;
  amount?: number;          // partial refunds; omit for full refund
  reason?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "succeeded" | "pending" | "failed";
}

export interface PaymentProvider {
  readonly id: "mock";

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;

  // Parse + signature-verify an incoming webhook request body.
  // Throws on invalid signature so the route returns 400.
  parseWebhook(args: { body: string; headers: Headers }): Promise<ParsedWebhookEvent>;

  refund(input: RefundInput): Promise<RefundResult>;
}
