// Payment provider factory.
// PAYMENT_PROVIDER=mock|payzone. Defaults to "mock" when MISO_DEMO_MODE=true,
// "payzone" otherwise. The factory caches a single instance per process.

import { isDemoMode } from "@/lib/demo";
import { MockPaymentProvider } from "./mock";
import { PayzoneProvider } from "./payzone";
import type { PaymentProvider } from "./provider";

export type { PaymentProvider } from "./provider";

let cached: PaymentProvider | undefined;

export function paymentProvider(): PaymentProvider {
  if (cached) return cached;
  const id = (process.env.PAYMENT_PROVIDER ?? (isDemoMode() ? "mock" : "payzone")).toLowerCase();
  switch (id) {
    case "mock":
      cached = new MockPaymentProvider();
      return cached;
    case "payzone":
      cached = new PayzoneProvider();
      return cached;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER=${id}. Expected "mock" or "payzone".`);
  }
}
