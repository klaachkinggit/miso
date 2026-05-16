import { redirect } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import {
  listAccountBalances,
  listBalanceLedgerEntries,
} from "@/lib/balances/ledger";
import { formatDate, formatPrice } from "@/lib/format";
import type { BalanceLedgerEntry } from "@/types/db";
import { FundingActions } from "./funding-actions";

function movementLabel(entry: BalanceLedgerEntry): string {
  return entry.movement_type.replaceAll("_", " ");
}

function movementSign(entry: BalanceLedgerEntry): "+" | "-" {
  return entry.movement_type.includes("debit") ? "-" : "+";
}

export default async function BalancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/balance");
  if (profile.role === "controller") redirect("/controller");

  const [balances, ledger] = await Promise.all([
    listAccountBalances(profile.id),
    listBalanceLedgerEntries(profile.id),
  ]);

  return (
    <div className="container py-10">
      <PageHeader
        title="Account balance"
        description="Internal MISO credit for ticket drops, official resale, and refunds."
        actions={<FundingActions />}
        className="mb-8"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {balances.length ? (
          balances.map((balance) => (
            <Card key={balance.id} className="glass rounded-lg">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{balance.currency}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatPrice(balance.available_amount, balance.currency)}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="glass rounded-lg md:col-span-2">
            <CardContent className="p-5 text-sm text-muted-foreground">
              No Account Balance has been granted yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="glass mt-8 rounded-lg">
        <CardHeader>
          <CardTitle>Ledger history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledger.length ? (
            <div className="divide-y divide-border/60">
              {ledger.map((entry) => (
                <div key={entry.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium capitalize">{movementLabel(entry)}</p>
                      <Badge variant={movementSign(entry) === "-" ? "secondary" : "success"}>
                        {entry.currency}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(entry.created_at)} · {entry.reference_type}:{entry.reference_id}
                    </p>
                  </div>
                  <p className={movementSign(entry) === "-" ? "font-semibold text-destructive" : "font-semibold text-accent"}>
                    {movementSign(entry)}
                    {formatPrice(entry.amount, entry.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">No ledger entries yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
