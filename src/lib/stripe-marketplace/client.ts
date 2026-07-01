import { z } from "zod";
import Stripe from "stripe";

// Module-local env loader. Kept here instead of extending the global
// serverEnv() so stripe-marketplace stays self-contained: only this
// module reads STRIPE_* keys, and removing the feature means deleting
// one folder.

const StripeEnv = z.object({
  STRIPE_SECRET_KEY: z.string().min(20).startsWith("rk_"),
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

let cachedClient: Stripe | undefined;

export function stripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const env = stripeEnv();
  cachedClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
    appInfo: {
      name: "miso-stripe-marketplace",
      version: "0.1.0",
    },
  });
  return cachedClient;
}
