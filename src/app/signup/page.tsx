import Link from "next/link";
import { ArrowRight, Building2, ShoppingBag } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell>
      <div className="grid gap-6">
        <div>
          <p className="mb-3 text-sm font-medium text-primary">Join MISO</p>
          <h1 className="text-3xl font-semibold tracking-tight">Get started on MISO</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Organizers build a ticketing workspace with Stripe payouts and a branded storefront. Buyers
            grab tickets in seconds.
          </p>
        </div>
        <Link
          href="/signup/organizer"
          className="group flex items-start justify-between gap-4 rounded-xl border border-accent/40 bg-card/80 p-5 transition-colors hover:border-accent"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Create your organization</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Launch a branded ticketing page, get paid through Stripe Connect, manage your team and
                resale rules in one workspace.
              </p>
            </div>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 text-accent transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/signup/buyer"
          className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-card/70 p-5 transition-colors hover:border-accent/60"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Buy tickets</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick up event tickets, keep them in your account, and resell at face value through the
                official exchange.
              </p>
            </div>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
