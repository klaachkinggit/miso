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

  let status: Awaited<ReturnType<typeof syncConnectAccountStatus>> | null = null;
  let error: string | null = null;
  try {
    status = await syncConnectAccountStatus(profile.id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not verify your Stripe onboarding.";
  }

  if (status?.onboarding_complete) redirect("/admin");

  return (
    <AuthShell>
      <div className="grid gap-5">
        <div>
          <p className="mb-3 text-sm font-medium text-primary">Almost there</p>
          <h1 className="text-3xl font-semibold tracking-tight">Stripe onboarding incomplete</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Stripe has not yet confirmed your account is ready to accept payments. Finish the
            remaining steps and you&apos;ll unlock the organizer dashboard.
          </p>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
        {status ? (
          <ul className="space-y-2 rounded-md border border-border bg-card/60 p-4 text-sm">
            <li>Details submitted: <span className={status.details_submitted ? "text-emerald-300" : "text-amber-300"}>{status.details_submitted ? "yes" : "pending"}</span></li>
            <li>Charges enabled: <span className={status.charges_enabled ? "text-emerald-300" : "text-amber-300"}>{status.charges_enabled ? "yes" : "pending"}</span></li>
            <li>Payouts enabled: <span className={status.payouts_enabled ? "text-emerald-300" : "text-amber-300"}>{status.payouts_enabled ? "yes" : "pending"}</span></li>
          </ul>
        ) : null}
        <Button asChild size="lg" className="w-full">
          <Link href="/signup/organizer/stripe">Resume Stripe onboarding</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
