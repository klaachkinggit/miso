"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StripeElements = {
  create: (type: "payment") => { mount: (selector: string) => void };
};

type StripeClient = {
  elements: (options: { clientSecret: string }) => StripeElements;
  confirmPayment: (options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
  }) => Promise<{ error?: { message?: string } }>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeClient;
  }
}

interface CheckoutPayload {
  marketplacePaymentId: string;
  paymentIntentId: string;
  clientSecret: string;
  amountTotalCents: number;
  currency: "EUR";
  // Set when a zero-amount (free) primary checkout fulfilled inline — no
  // Stripe step; the tickets are already minted.
  free?: boolean;
  error?: string;
}

export function CardCheckoutForm({
  mode,
  id,
  quantity,
  extraGuests,
  giftEmail,
  returnPath,
  promo,
}: {
  mode: "primary" | "resale";
  id: string;
  quantity?: number;
  extraGuests?: number;
  giftEmail?: string;
  returnPath?: string;
  promo?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const paymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function init() {
      try {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) throw new Error("Stripe publishable key is missing.");
        await loadStripeScript();
        if (!window.Stripe) throw new Error("Stripe.js did not load.");

        const endpoint =
          mode === "primary"
            ? "/api/stripe-marketplace/checkout/primary"
            : "/api/stripe-marketplace/checkout/resale";

        const primaryBody: Record<string, unknown> = { category_id: id };
        if (quantity !== undefined) primaryBody.quantity = quantity;
        if (extraGuests !== undefined) primaryBody.extra_guests_count = extraGuests;
        if (giftEmail) primaryBody.gift_recipient_email = giftEmail;
        if (returnPath) primaryBody.return_path = returnPath;
        if (promo) primaryBody.promo = promo;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(mode === "primary" ? primaryBody : { listing_id: id }),
        });
        const payload = (await response.json()) as CheckoutPayload;
        if (!response.ok) throw new Error(payload.error ?? "Card checkout could not start.");
        if (canceled) return;

        if (payload.free) {
          window.location.assign("/tickets?claimed=1");
          return;
        }

        const stripe = window.Stripe(publishableKey);
        const elements = stripe.elements({ clientSecret: payload.clientSecret });
        elements.create("payment").mount("#payment-element");
        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentIdRef.current = payload.marketplacePaymentId;
        setAmount(payload.amountTotalCents);
        setLoading(false);
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Card checkout could not start.");
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      canceled = true;
    };
  }, [id, mode, quantity, extraGuests, giftEmail, returnPath, promo]);

  async function submit() {
    if (!stripeRef.current || !elementsRef.current || !paymentIdRef.current) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?marketplace_payment_id=${paymentIdRef.current}`,
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment could not be confirmed.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="glass mx-auto w-full max-w-xl rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Card checkout
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {amount !== null ? (
          <div className="rounded-md border border-border/70 p-3 text-sm">
            Total {(amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </div>
        ) : null}
        <div id="payment-element" className="min-h-28 rounded-md border border-border/70 bg-background/40 p-3" />
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing secure card payment
          </p>
        ) : null}
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
        <Button type="button" onClick={submit} disabled={loading || submitting || Boolean(error)}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Pay by card
        </Button>
      </CardContent>
    </Card>
  );
}

function loadStripeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[src='https://js.stripe.com/v3/']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Stripe.js failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Stripe.js failed to load.")), { once: true });
    document.head.appendChild(script);
  });
}
