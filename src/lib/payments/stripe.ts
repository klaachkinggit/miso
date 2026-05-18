import Stripe from "stripe";
import type { Currency } from "@/types/db";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia" as const,
});

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function stripeCurrency(currency: Currency): string {
  return currency.toLowerCase();
}

export interface StripeCheckoutInput {
  purchaseId: string;
  amount: number;
  currency: Currency;
  eventName: string;
  categoryName: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: stripeCurrency(input.currency),
          unit_amount: toCents(input.amount),
          product_data: {
            name: `${input.eventName} — ${input.categoryName}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      type: "purchase",
      purchase_id: input.purchaseId,
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  });
}

export interface ResaleStripeCheckoutInput {
  listingId: string;
  buyerUserId: string;
  amount: number;
  currency: Currency;
  eventName: string;
  categoryName: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createResaleStripeCheckoutSession(
  input: ResaleStripeCheckoutInput,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: stripeCurrency(input.currency),
          unit_amount: toCents(input.amount),
          product_data: {
            name: `${input.eventName} — ${input.categoryName} (Resale)`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      type: "resale",
      listing_id: input.listingId,
      buyer_id: input.buyerUserId,
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  });
}

export async function refundStripeSession(sessionId: string): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
  const pi = session.payment_intent;
  if (!pi || typeof pi === "string") return;
  if (pi.status !== "succeeded") return;
  await stripe.refunds.create({ payment_intent: pi.id });
}
