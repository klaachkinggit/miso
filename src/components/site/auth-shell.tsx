import { RadioTower, ShieldCheck, Ticket, WalletCards } from "lucide-react";

type AuthShellProps = {
  children: React.ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="container grid min-h-[calc(100vh-4rem)] items-center gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
      <div className="mx-auto w-full max-w-md rounded-lg border border-white/[0.08] bg-card/80 p-6 shadow-[0_26px_90px_-52px_rgba(0,0,0,0.95)] backdrop-blur sm:p-8">
        {children}
      </div>

      <div className="hidden lg:block">
        <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(140deg,hsl(220_23%_9%),hsl(222_28%_5%))] p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
          <div className="mb-12 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tonight</p>
              <h2 className="mt-1 text-2xl font-semibold">Casa Summer Pass</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ticket className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Entry ticket</p>
                  <p className="mt-1 text-lg font-semibold">General admission</p>
                </div>
                <span className="rounded-md bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                  Valid
                </span>
              </div>
              <div className="h-28 rounded-md border border-dashed border-white/15 bg-[linear-gradient(135deg,hsl(162_82%_48%/.18),transparent_42%),linear-gradient(315deg,hsl(37_92%_57%/.16),transparent_45%)] p-4">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <WalletCards className="h-4 w-4 text-primary" />
                    Wallet-bound collectible
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 15 }).map((_, index) => (
                      <span
                        key={index}
                        className="h-1.5 rounded-full bg-white/25"
                        style={{ opacity: index % 4 === 0 ? 0.35 : 0.8 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                <RadioTower className="mb-4 h-5 w-5 text-accent" />
                <p className="text-sm text-muted-foreground">Gate status</p>
                <p className="mt-1 font-semibold">Live session</p>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                <ShieldCheck className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Verification</p>
                <p className="mt-1 font-semibold">Owner signed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
