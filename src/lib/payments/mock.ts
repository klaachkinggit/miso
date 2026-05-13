import crypto from "node:crypto";
import type { Currency } from "@/types/db";

export interface MockCheckoutInput {
  purchaseId: string;
  ticketId: string;
  buyerUserId: string;
  buyerEmail?: string;
  eventId: string;
  eventName: string;
  eventVenue: string;
  eventImage?: string | null;
  categoryName: string;
  amount: number;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
}

export interface MockCheckoutResult {
  redirectUrl: string;
  providerSessionId: string;
  providerPaymentId: string;
  paymentProvider: "mock";
  inlineOutcome: "paid";
}

export interface MockRefundResult {
  providerRefundId: string;
  status: "succeeded";
}

export async function createMockCheckout(input: MockCheckoutInput): Promise<MockCheckoutResult> {
  return {
    providerSessionId: `mock_${crypto.randomUUID()}`,
    providerPaymentId: `mock_pi_${crypto.randomUUID()}`,
    paymentProvider: "mock",
    inlineOutcome: "paid",
    redirectUrl: `${input.successUrl}&mock=1`,
  };
}

export async function refundMockPayment(): Promise<MockRefundResult> {
  return {
    providerRefundId: `mock_re_${crypto.randomUUID()}`,
    status: "succeeded",
  };
}
