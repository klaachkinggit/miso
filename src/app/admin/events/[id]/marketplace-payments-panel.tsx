"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/format";
import type { MarketplacePayment } from "@/types/db";
import { refundMarketplacePaymentAction } from "../../actions";

const REFUNDABLE_STATUSES: MarketplacePayment["status"][] = [
  "succeeded",
  "fulfillment_pending",
  "transfers_pending",
  "paid",
  "repair_needed",
  "disputed",
];

function statusVariant(
  status: MarketplacePayment["status"],
): "destructive" | "warning" | "success" | "secondary" {
  if (status === "refunded") return "destructive";
  if (status === "failed") return "destructive";
  if (status === "repair_needed" || status === "disputed") return "warning";
  if (status === "refund_pending") return "warning";
  if (status === "paid") return "success";
  return "secondary";
}

function formatCents(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function MarketplacePaymentsPanel({
  payments,
  eventId,
  buyerLabels,
}: {
  payments: MarketplacePayment[];
  eventId: string;
  buyerLabels: Record<string, string>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!payments.length) {
    return (
      <Card className="rounded-lg">
        <CardContent className="p-5 text-sm text-muted-foreground">
          No marketplace payments for this event yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {payments.map((payment) => {
        const refundable = REFUNDABLE_STATUSES.includes(payment.status);
        const confirming = confirmId === payment.id;
        return (
          <Card key={payment.id} className="rounded-lg">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{payment.kind}</Badge>
                  <Badge variant={statusVariant(payment.status)}>
                    {payment.status}
                  </Badge>
                  <span className="font-semibold text-sm">
                    {formatCents(payment.amount_total_cents, payment.currency)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Buyer:{" "}
                  {buyerLabels[payment.buyer_user_id] ?? payment.buyer_user_id}
                </p>
                {payment.stripe_payment_intent_id ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                    PI: {payment.stripe_payment_intent_id}
                  </p>
                ) : null}
                {payment.stripe_charge_id ? (
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    CH: {payment.stripe_charge_id}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {formatDateShort(payment.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {refundable && !confirming ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmId(payment.id)}
                  >
                    Refund
                  </Button>
                ) : null}
                {confirming ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={refundMarketplacePaymentAction}>
                      <input
                        type="hidden"
                        name="payment_id"
                        value={payment.id}
                      />
                      <input type="hidden" name="event_id" value={eventId} />
                      <Button type="submit" variant="destructive" size="sm">
                        Confirm refund
                      </Button>
                    </form>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
