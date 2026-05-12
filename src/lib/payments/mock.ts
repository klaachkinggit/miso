// MockPaymentProvider — synchronous in-process provider for the free demo.
//
// createCheckout immediately marks the purchase as paid via the webhook URL,
// so the buyer is redirected to the success page with a real DB-paid purchase.
// No external network, no credentials, no costs.

import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { fulfillPurchase } from "@/lib/tickets/mint";
import { releaseReservation } from "@/lib/tickets/reserve";
import type { Purchase } from "@/types/db";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "./provider";

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock" as const;

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerSessionId = `mock_${crypto.randomUUID()}`;
    const sb = createServiceClient();

    await sb
      .from("purchases")
      .update({
        provider_session_id: providerSessionId,
        payment_provider: this.id,
      })
      .eq("id", input.purchaseId);

    // Simulate a paid webhook synchronously so the demo is one click.
    try {
      await fulfillPurchase({
        ticketId: input.ticketId,
        buyerUserId: input.buyerUserId,
        purchaseId: input.purchaseId,
      });
      await sb
        .from("purchases")
        .update({ provider_payment_id: `mock_pi_${crypto.randomUUID()}` })
        .eq("id", input.purchaseId);
    } catch (error) {
      await releaseReservation(input.ticketId);
      await sb.from("purchases").update({ status: "failed" }).eq("id", input.purchaseId);
      throw error;
    }

    return {
      providerSessionId,
      redirectUrl: `${input.successUrl}&mock=1`,
    };
  }

  async parseWebhook(): Promise<ParsedWebhookEvent> {
    // Mock provider does not send webhooks — payment is fulfilled inline.
    return {
      id: `mock_evt_${crypto.randomUUID()}`,
      kind: "ignored",
      providerSessionId: null,
      providerPaymentId: null,
      purchaseId: null,
      raw: null,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    // Mock refund always succeeds. Look up purchase by provider_payment_id to
    // record the refund id, but state changes are owned by the caller.
    const sb = createServiceClient();
    const refundId = `mock_re_${crypto.randomUUID()}`;
    const { data: purchase } = await sb
      .from("purchases")
      .select("id")
      .eq("provider_payment_id", input.providerPaymentId)
      .maybeSingle<Pick<Purchase, "id">>();
    if (purchase) {
      // Audit trail only; status flip is handled by refundTicket().
    }
    return { providerRefundId: refundId, status: "succeeded" };
  }
}
