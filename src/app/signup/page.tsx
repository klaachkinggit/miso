import Link from "next/link";
import { ArrowUpRight, Building2, ShoppingBag } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell>
      <div className="grid gap-6">
        <div>
          <p className="eyebrow-signal">Choose your role</p>
          <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
            Join MISO.
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Organizers build a workspace with Stripe payouts and a branded
            storefront. Buyers grab tickets in seconds.
          </p>
        </div>
        <Link
          href="/signup/organizer"
          className="group relative flex items-start gap-5 rounded-md border border-hairline-strong bg-ink-raised p-6 transition-colors hover:border-signal/60"
        >
          <span
            aria-hidden
            className="absolute -left-px top-6 h-10 w-[2px] bg-signal"
          />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hairline bg-ink text-signal">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-medium text-foreground">
                Create your organization
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                Recommended
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Launch a branded ticketing page, take payouts through Stripe
              Connect, manage team and resale rules in one workspace.
            </p>
          </div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
        </Link>
        <Link
          href="/signup/buyer"
          className="group flex items-start gap-5 rounded-md border border-hairline bg-ink-raised/40 p-6 transition-colors hover:border-hairline-strong"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hairline bg-ink text-muted-foreground">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-foreground">Buy tickets</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick up event tickets, keep them in your account, resell at face
              value through the official exchange.
            </p>
          </div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-signal hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
