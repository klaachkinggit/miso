import { z } from "zod";
import Stripe from "stripe";

// Module-local env loader. Kept here instead of extending the global
// serverEnv() so stripe-marketplace stays self-contained: only this
// module reads STRIPE_* keys, and removing the feature means deleting
// one folder.

const StripeEnv = z.object({
  STRIPE_SECRET_KEY: z.string().min(20).startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().min(10).startsWith("whsec_"),
  // The marketplace webhook is a separate registered endpoint in Stripe and
  // gets its own signing secret. Falls back to STRIPE_WEBHOOK_SECRET for
  // single-endpoint dev setups.
  STRIPE_MARKETPLACE_WEBHOOK_SECRET: z
    .string()
    .min(10)
    .startsWith("whsec_")
    .optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .startsWith("pk_")
    .optional(),
  MISO_MARKETPLACE_FEE_BPS: z
    .string()
    .regex(/^\d+$/)
    .default("500")
    .transform((s) => Number(s))
    .refine((n) => n >= 0 && n <= 10000, "fee bps out of range"),
});

let cachedEnv: z.infer<typeof StripeEnv> | undefined;

export function stripeEnv() {
  if (cachedEnv) return cachedEnv;
  const parsed = StripeEnv.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid Stripe marketplace env:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetStripeEnvCacheForTest() {
  cachedEnv = undefined;
}

// Single Stripe SDK instance per server process. Reusing one Stripe()
// keeps the underlying HTTP agent + retry config consistent across
// every route and webhook handler.

let cachedClient: Stripe | undefined;

export function stripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const env = stripeEnv();
  cachedClient = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin an explicit API version so a future global Stripe upgrade
    // never silently changes payload shapes. Bump deliberately.
    // Keep in lockstep with src/lib/payments/stripe.ts.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "miso-stripe-marketplace",
      version: "0.1.0",
    },
  });
  return cachedClient;
}

export function resetStripeClientForTest() {
  cachedClient = undefined;
}

// Inject a fake Stripe SDK for E2E tests that exercise every layer
// without a network call. Production code never calls this.
export function setStripeClientForTest(fake: Stripe) {
  cachedClient = fake;
}
