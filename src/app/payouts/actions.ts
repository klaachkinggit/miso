"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createOnboardingLink } from "@/lib/stripe-marketplace/seller-accounts";
import { getConfiguredAppUrl } from "@/lib/url";

function fail(message: string): never {
  redirect(`/payouts?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function startSellerStripeConnect() {
  const profile = await requireRole("user");
  let url = "";
  try {
    const link = await createOnboardingLink({
      userId: profile.id,
      email: profile.email,
      appUrl: getConfiguredAppUrl(),
      returnPath: "/payouts",
    });
    url = link.url;
  } catch (error) {
    fail(errorMessage(error, "Stripe onboarding could not be started."));
  }
  redirect(url);
}
