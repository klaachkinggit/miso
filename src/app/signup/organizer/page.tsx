import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { getCurrentProfile } from "@/lib/auth";
import { OrganizerSignupForm } from "./signup-form";

export default async function OrganizerSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  // If they're already onboarded as an organizer, jump straight to the
  // dashboard. If they're mid-onboarding (signed up but no Stripe
  // account yet) the Stripe step picks up where they left off.
  const profile = await getCurrentProfile();
  if (profile?.role === "admin" || profile?.role === "organizer") redirect("/admin");
  if (profile) redirect("/signup/organizer/stripe");

  const params = await searchParams;
  return (
    <AuthShell>
      <OrganizerSignupForm error={params?.error} />
    </AuthShell>
  );
}
