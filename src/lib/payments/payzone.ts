// PayzoneProvider — production Moroccan card processor.
//
// IMPORTANT: this implementation is a structural stub. The exact PayZone API
// endpoints, signature scheme and field names are defined by the merchant
// onboarding documentation which is only released after the contract is
// signed. The shape below matches the public Payzone Maroc HPP integration
// docs (hashed signature, redirect to hosted page, async notification URL).
//
// To go live, fill in:
//   - PAYZONE_API_BASE
//   - PAYZONE_MERCHANT_ID
//   - PAYZONE_API_KEY
//   - PAYZONE_HMAC_SECRET   (for webhook signature verification)
// and audit the request/response field names against the merchant kit.

import crypto from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookEventKind,
} from "./provider";

interface PayzoneConfig {
  apiBase: string;
  merchantId: string;
  apiKey: string;
  hmacSecret: string;
}

function loadConfig(): PayzoneConfig {
  const apiBase = process.env.PAYZONE_API_BASE;
  const merchantId = process.env.PAYZONE_MERCHANT_ID;
  const apiKey = process.env.PAYZONE_API_KEY;
  const hmacSecret = process.env.PAYZONE_HMAC_SECRET;
  if (!apiBase || !merchantId || !apiKey || !hmacSecret) {
    throw new Error(
      "PayZone credentials missing. Set PAYZONE_API_BASE, PAYZONE_MERCHANT_ID, PAYZONE_API_KEY, PAYZONE_HMAC_SECRET — or set PAYMENT_PROVIDER=mock for the free demo.",
    );
  }
  return { apiBase, merchantId, apiKey, hmacSecret };
}

function signBody(body: string, hmacSecret: string): string {
  return crypto.createHmac("sha256", hmacSecret).update(body).digest("hex");
}

export class PayzoneProvider implements PaymentProvider {
  readonly id = "payzone" as const;

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const cfg = loadConfig();

    const payload = {
      merchant_id: cfg.merchantId,
      order_id: input.purchaseId,
      amount: Math.round(input.amount * 100), // minor units (centimes)
      currency: input.currency,
      customer_email: input.buyerEmail ?? undefined,
      description: `${input.eventName} — ${input.categoryName}`,
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      notification_url: input.webhookUrl,
      metadata: {
        purchase_id: input.purchaseId,
        ticket_id: input.ticketId,
        buyer_user_id: input.buyerUserId,
        event_id: input.eventId,
      },
    };
    const body = JSON.stringify(payload);

    const response = await fetch(`${cfg.apiBase}/checkout/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
        "x-signature": signBody(body, cfg.hmacSecret),
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`PayZone checkout failed: ${response.status} ${text}`);
    }
    const data = (await response.json()) as { session_id: string; redirect_url: string };
    return {
      providerSessionId: data.session_id,
      redirectUrl: data.redirect_url,
    };
  }

  async parseWebhook(args: { body: string; headers: Headers }): Promise<ParsedWebhookEvent> {
    const cfg = loadConfig();

    const incomingSig = args.headers.get("x-signature") ?? "";
    const expected = signBody(args.body, cfg.hmacSecret);
    if (
      incomingSig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(incomingSig), Buffer.from(expected))
    ) {
      throw new Error("Invalid PayZone webhook signature");
    }

    const raw = JSON.parse(args.body) as {
      event_id: string;
      event_type: string;
      session_id?: string;
      payment_id?: string;
      metadata?: { purchase_id?: string };
    };

    const kindMap: Record<string, WebhookEventKind> = {
      "payment.succeeded": "payment.succeeded",
      "payment.failed": "payment.failed",
      "payment.expired": "payment.expired",
      "refund.succeeded": "refund.succeeded",
      "refund.failed": "refund.failed",
    };

    return {
      id: raw.event_id,
      kind: kindMap[raw.event_type] ?? "ignored",
      providerSessionId: raw.session_id ?? null,
      providerPaymentId: raw.payment_id ?? null,
      purchaseId: raw.metadata?.purchase_id ?? null,
      raw,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const cfg = loadConfig();

    const payload = {
      payment_id: input.providerPaymentId,
      amount: typeof input.amount === "number" ? Math.round(input.amount * 100) : undefined,
      reason: input.reason,
    };
    const body = JSON.stringify(payload);

    const response = await fetch(`${cfg.apiBase}/refunds`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
        "x-signature": signBody(body, cfg.hmacSecret),
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`PayZone refund failed: ${response.status} ${text}`);
    }
    const data = (await response.json()) as { refund_id: string; status: "succeeded" | "pending" | "failed" };
    return { providerRefundId: data.refund_id, status: data.status };
  }
}
