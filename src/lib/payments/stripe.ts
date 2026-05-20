import Stripe from "stripe";
import { RESERVATION_TTL_SECONDS } from "@/lib/tickets/lifecycle";
import type { Currency } from "@/types/db";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia" as const,
  });
  return stripeClient;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeClient()[prop as keyof Stripe];
  },
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
  quantity?: number;
  currency: Currency;
  eventName: string;
  categoryName: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput,
  opts: { idempotencyKey?: string } = {},
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create(
    {
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
          quantity: input.quantity ?? 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        type: "purchase",
        purchase_id: input.purchaseId,
      },
      expires_at: Math.floor(Date.now() / 1000) + RESERVATION_TTL_SECONDS,
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

export interface ResaleStripeCheckoutInput {
  listingId: string;
  buyerUserId: string;
  amount: number;
  platformFeeAmount?: number;
  currency: Currency;
  eventName: string;
  categoryName: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
}

export async function createResaleStripeCheckoutSession(
  input: ResaleStripeCheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const platformFeeAmount = input.platformFeeAmount ?? 0;
  const lineItems = [
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
  ];

  if (platformFeeAmount > 0) {
    lineItems.push({
      price_data: {
        currency: stripeCurrency(input.currency),
        unit_amount: toCents(platformFeeAmount),
        product_data: {
          name: "MISO marketplace platform fee",
        },
      },
      quantity: 1,
    });
  }

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        type: "resale",
        listing_id: input.listingId,
        buyer_id: input.buyerUserId,
        seller_amount: String(input.amount),
        platform_fee_amount: String(platformFeeAmount),
        buyer_total: String(input.amount + platformFeeAmount),
      },
      expires_at: Math.floor(Date.now() / 1000) + RESERVATION_TTL_SECONDS,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
}

export async function expireStripeCheckoutSession(sessionId: string): Promise<void> {
  await stripe.checkout.sessions.expire(sessionId);
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
