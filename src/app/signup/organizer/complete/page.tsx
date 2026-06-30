import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { syncConnectAccountStatus } from "@/lib/payments/stripe-connect";

// Stripe return_url. We sync the account's flags back into the
// profile here — if `details_submitted` + `charges_enabled` is true,
// `syncConnectAccountStatus` also promotes the profile to organizer.
export default async function OrganizerCompletePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signup/organizer");

  let status: Awaited<ReturnType<typeof syncConnectAccountStatus>> | null =
    null;
  let error: string | null = null;
  try {
    status = await syncConnectAccountStatus(profile.id);
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Could not verify your Stripe onboarding.";
  }

  if (status?.onboarding_complete) redirect("/admin");

  return (
    <AuthShell>
      <div className="grid gap-5">
        <div>
          <p className="eyebrow-signal mb-3">Almost there</p>
          <h1 className="display text-3xl text-foreground md:text-4xl">
            Stripe onboarding incomplete
            <span className="display-italic">.</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Stripe has not yet confirmed your account is ready to accept
            payments. Finish the remaining steps and you&apos;ll unlock the
            organizer dashboard.
          </p>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
        {status ? (
          <ul className="space-y-2 rounded-md border border-hairline bg-ink-raised p-4 text-sm">
            <li>
              Details submitted:{" "}
              <span
                className={
                  status.details_submitted
                    ? "text-signal"
                    : "text-muted-foreground"
                }
              >
                {status.details_submitted ? "yes" : "pending"}
              </span>
            </li>
            <li>
              Charges enabled:{" "}
              <span
                className={
                  status.charges_enabled
                    ? "text-signal"
                    : "text-muted-foreground"
                }
              >
                {status.charges_enabled ? "yes" : "pending"}
              </span>
            </li>
            <li>
              Payouts enabled:{" "}
              <span
                className={
                  status.payouts_enabled
                    ? "text-signal"
                    : "text-muted-foreground"
                }
              >
                {status.payouts_enabled ? "yes" : "pending"}
              </span>
            </li>
          </ul>
        ) : null}
        <Button asChild size="lg" className="w-full">
          <Link href="/signup/organizer/stripe">Resume Stripe onboarding</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
