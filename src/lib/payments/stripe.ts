import Stripe from "stripe";

// Shared Stripe client. The legacy Checkout-Session creation flow that once
// lived here was retired with the legacy stack (ADR 0003); all purchase and
// resale checkout now runs on the marketplace PaymentIntent path. The
// `stripe` client and the session-based refund helper remain — the latter is
// still used by the admin ticket-refund action for pre-marketplace sales.

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia" as const,
  });
  return stripeClient;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeClient()[prop as keyof Stripe];
  },
});

export async function refundStripeSession(sessionId: string): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
  const pi = session.payment_intent;
  if (!pi || typeof pi === "string") return;
  if (pi.status !== "succeeded") return;
  await stripe.refunds.create({ payment_intent: pi.id });
}
