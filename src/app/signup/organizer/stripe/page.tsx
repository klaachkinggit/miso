import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import {
  createOrganizerOnboardingLink,
  ensureConnectAccountForProfile,
} from "@/lib/payments/stripe-connect";
import { StepIndicator } from "../step-indicator";

// Gateway between the questionnaire and Stripe Connect. We provision
// the connected account here (idempotently) and immediately redirect
// to the Stripe-hosted onboarding URL. If Stripe call fails, render a
// retry shell so the operator isn't stuck on a redirect loop.
export default async function OrganizerStripePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signup/organizer");
  if (profile.role === "admin" || profile.role === "organizer") redirect("/admin");

  let onboardingUrl: string | null = null;
  let errorMessage: string | null = null;
  try {
    const accountId = await ensureConnectAccountForProfile(profile);
    onboardingUrl = await createOrganizerOnboardingLink(accountId);
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Could not start Stripe onboarding.";
  }

  if (onboardingUrl) redirect(onboardingUrl);

  return (
    <AuthShell>
      <div className="grid gap-6">
        <div>
          <StepIndicator current={2} />
          <h1 className="display mt-5 text-4xl text-foreground md:text-5xl">
            Could not reach<br />
            <span className="display-italic">Stripe.</span>
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            We could not start your Stripe Connect onboarding. Retry — your account is saved and
            you can resume any time.
          </p>
        </div>
        {errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <form action="/signup/organizer/stripe" method="get">
          <Button type="submit" size="lg" className="w-full">
            Retry Stripe onboarding
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
