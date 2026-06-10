import { ArrowUpRight } from "lucide-react";

type AuthShellProps = {
  children: React.ReactNode;
};

const PROOF = [
  { metric: "200+", label: "Organizers onboarded" },
  { metric: "0%", label: "Scalping markup tolerated" },
  { metric: "T+1", label: "Stripe payouts to your bank" },
];

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="container grid min-h-[calc(100vh-4rem)] items-stretch gap-0 py-0 lg:grid-cols-[1fr_1fr]">
      <div className="flex items-center justify-center py-10 lg:py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>

      <aside className="relative hidden border-l border-hairline lg:flex">
        <div className="grain flex h-full w-full flex-col justify-between px-10 py-14">
          <div>
            <p className="eyebrow-signal">Why MISO</p>
            <h2 className="display mt-6 text-4xl text-foreground">
              Ticketing,<br />
              <span className="display-italic" style={{ color: "hsl(var(--signal))" }}>
                without the gatekeeper.
              </span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every organization gets its own Stripe Connect account, its own storefront, its own
              resale exchange. Your audience, your data, your payouts.
            </p>
          </div>

          <dl className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
            {PROOF.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 bg-ink px-5 py-4"
              >
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="display text-2xl text-foreground">{row.metric}</dd>
              </div>
            ))}
          </dl>

          <a
            href="/"
            className="group inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to homepage
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </aside>
    </div>
  );
}
