import type Stripe from "stripe";

import { audit } from "@/lib/audit";
import { stripeClient, stripeEnv } from "./client";
import { WebhookSignatureError } from "./errors";
import {
  settleCanceledPaymentIntent,
  settleFailedPaymentIntent,
  settleSucceededPaymentIntent,
} from "./fulfillment";
import { getMarketplacePaymentByIntent } from "./payments";
import { transitionPayment } from "./state-machine";
import { recordExternalChargeRefund } from "./refunds";
import { syncSellerAccountFromStripe } from "./seller-accounts";

// Single dispatch entrypoint for the Stripe webhook route. The route
// handler is a thin shell that:
//   1. reads raw body
//   2. verifies the signature here
//   3. calls handleWebhookEvent()
//
// Keep webhook logic side-effect-free except for the DB writes the
// helpers do — never call back into Stripe from here unless absolutely
// required (we already created PaymentIntent and transfers elsewhere).

// Pure: extract charge id across both Stripe API shapes (post-2022 `latest_charge`
// vs legacy `charges.data[]`). Returns null when neither is populated.
export function extractChargeId(intent: Stripe.PaymentIntent): string | null {
  if (typeof intent.latest_charge === "string") return intent.latest_charge;
  const legacy = (intent as unknown as { charges?: { data?: Array<{ id?: string }> } })
    .charges?.data;
  if (Array.isArray(legacy) && legacy[0]?.id) return legacy[0].id;
  return null;
}

export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event {
  if (!signatureHeader) throw new WebhookSignatureError();
  const env = stripeEnv();
  const stripe = stripeClient();
  try {
    return stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new WebhookSignatureError();
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const chargeId = extractChargeId(intent);
      if (!chargeId) {
        throw new Error(
          `payment_intent.succeeded ${intent.id} has no charge id`,
        );
      }
      await settleSucceededPaymentIntent({
        paymentIntentId: intent.id,
        chargeId,
      });
      return;
    }

    case "payment_intent.payment_failed": {
      // Soft-failure: a PI attempt failed but Stripe may retry on a
      // different payment method. Do NOT terminalize the marketplace
      // row here. Wait for payment_intent.canceled to release.
      const intent = event.data.object as Stripe.PaymentIntent;
      await settleFailedPaymentIntent({
        paymentIntentId: intent.id,
        failureMessage:
          intent.last_payment_error?.message ?? "payment_intent.payment_failed",
      });
      return;
    }

    case "payment_intent.canceled": {
      // Terminal failure event. Stripe will not retry this PI.
      // Release ticket reservation / listing claim and mark failed.
      const intent = event.data.object as Stripe.PaymentIntent;
      await settleCanceledPaymentIntent({
        paymentIntentId: intent.id,
        cancellationReason:
          intent.cancellation_reason ?? "payment_intent.canceled",
      });
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) return;
      const payment = await getMarketplacePaymentByIntent(intentId);
      if (!payment) return;
      const refund = (charge.refunds?.data ?? [])[0];
      if (!refund) return;
      await recordExternalChargeRefund({ payment, refund });
      return;
    }

    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId =
        typeof dispute.charge === "string"
          ? dispute.charge
          : dispute.charge?.id;
      if (!chargeId) return;
      // Locate by charge via PaymentIntent metadata lookup.
      const stripe = stripeClient();
      const charge = await stripe.charges.retrieve(chargeId);
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) return;
      const payment = await getMarketplacePaymentByIntent(intentId);
      if (!payment) return;
      await transitionPayment(payment.id, { type: "DISPUTED" });
      await audit({
        actorUserId: payment.buyer_user_id,
        action: "marketplace.dispute",
        entityType: "marketplace_payment",
        entityId: payment.id,
        metadata: {
          stripe_dispute_id: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
          event_type: event.type,
        },
      });
      return;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await syncSellerAccountFromStripe(account.id);
      return;
    }

    default:
      // Quietly ignore unrelated events — the webhook endpoint is
      // shared with other Stripe products in the future.
      return;
  }
}
