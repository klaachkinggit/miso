// Payment provider factory. Demo branch only ships the mock provider.

import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";

export type { PaymentProvider } from "./provider";

let cached: PaymentProvider | undefined;

export function paymentProvider(): PaymentProvider {
  if (!cached) cached = new MockPaymentProvider();
  return cached;
}
