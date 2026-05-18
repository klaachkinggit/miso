import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import {
  handleStripeCheckoutEvent,
  isKnownCheckoutSettlementDelay,
} from "@/lib/payments/webhook";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing stripe-signature or webhook secret" }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await handleStripeCheckoutEvent(event);
  } catch (error) {
    if (!isKnownCheckoutSettlementDelay(error)) {
      console.error("[stripe-webhook] processing failed:", error);
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
