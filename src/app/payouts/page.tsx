import { redirect } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getSellerAccountByUserId } from "@/lib/stripe-marketplace/seller-accounts";
import { startSellerStripeConnect } from "./actions";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/payouts");
  if (profile.role === "controller") redirect("/controller");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "organizer") redirect("/smartboard?tab=banking");

  const seller = await getSellerAccountByUserId(profile.id);
  const ready = Boolean(
    seller?.charges_enabled &&
      seller.payouts_enabled &&
      seller.details_submitted &&
      seller.seller_risk_status === "clear",
  );

  return (
    <div className="container max-w-3xl py-10">
      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {params.error}
        </div>
      ) : null}

      <Card className="glass rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payout setup
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-md border border-border/70 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Stripe Connect</span>
              <Badge variant={ready ? "success" : "warning"}>{ready ? "Ready" : "Required"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Charges</span>
              <Badge variant={seller?.charges_enabled ? "success" : "secondary"}>
                {seller?.charges_enabled ? "Enabled" : "Pending"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Payouts</span>
              <Badge variant={seller?.payouts_enabled ? "success" : "secondary"}>
                {seller?.payouts_enabled ? "Enabled" : "Pending"}
              </Badge>
            </div>
            {seller?.disabled_reason ? (
              <div className="rounded-md bg-secondary/50 p-3 text-muted-foreground">
                {seller.disabled_reason}
              </div>
            ) : null}
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Resale payouts are handled through Stripe Connect. Complete this once before listing a paid ticket on the exchange.
          </p>

          <form action={startSellerStripeConnect}>
            <Button type="submit" className="w-full sm:w-auto">
              <ShieldCheck className="h-4 w-4" />
              {seller ? "Continue Stripe setup" : "Start Stripe setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
