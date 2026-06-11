"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createOnboardingLink } from "@/lib/stripe-marketplace/seller-accounts";

function fail(message: string): never {
  redirect(`/payouts?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function startSellerStripeConnect() {
  const profile = await requireRole("user");
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  let url = "";
  try {
    const link = await createOnboardingLink({
      userId: profile.id,
      email: profile.email,
      appUrl: `${proto}://${host}`,
      returnPath: "/payouts",
    });
    url = link.url;
  } catch (error) {
    fail(errorMessage(error, "Stripe onboarding could not be started."));
  }
  redirect(url);
}
