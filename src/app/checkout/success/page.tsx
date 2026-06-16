import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { MarketplacePayment } from "@/types/db";
import { StatusPoller } from "./status-poller";

const FAILED_STATUSES = new Set(["failed", "refunded", "refund_pending"]);

// Buyer-facing status for a marketplace payment. Internal states like
// repair_needed/transfers_pending must never leak to the buyer; until
// the payment is terminal the buyer only sees fulfillment_pending.
function buyerFacingPaymentStatus(payment: MarketplacePayment): string {
  if (payment.status === "paid") return "paid";
  if (FAILED_STATUSES.has(payment.status)) return payment.status;
  return "fulfillment_pending";
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{
    marketplace_payment_id?: string;
  }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const marketplacePaymentId = params?.marketplace_payment_id;
  const sb = createServiceClient();

  let status = "pending";
  let resolved = false;
  let pendingTitle = "Preparing your digital ticket.";

  if (marketplacePaymentId) {
    const { data: payment } = await sb
      .from("marketplace_payments")
      .select("*")
      .eq("id", marketplacePaymentId)
      .eq("buyer_user_id", user.id)
      .maybeSingle<MarketplacePayment>();
    if (payment) {
      resolved = true;
      status = buyerFacingPaymentStatus(payment);
      if (payment.kind === "resale") pendingTitle = "Moving your digital ticket.";
    }
  }

  const paid = status === "paid";
  const failed = FAILED_STATUSES.has(status);
  const pending = !paid && !failed;

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <StatusPoller enabled={resolved && pending} />
      <div className="mx-auto w-full max-w-lg rounded-md border border-hairline bg-ink-raised p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-ink">
          {paid ? (
            <CheckCircle2 className="h-6 w-6 text-signal" />
          ) : failed ? (
            <XCircle className="h-6 w-6 text-destructive" />
          ) : (
            <Clock className="h-6 w-6 text-signal" />
          )}
        </div>
        <Badge variant={paid ? "signal" : failed ? "destructive" : "warning"} className="mt-6">
          {status}
        </Badge>
        <h1 className="display mt-5 text-3xl text-foreground md:text-4xl">
          {paid
            ? "Ticket is ready."
            : failed
              ? "Payment not completed."
              : pendingTitle}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {paid
            ? "Your digital ticket is ready in My tickets."
            : failed
              ? "The reservation was released. Try checkout again."
              : "This page refreshes while we finalize your ticket."}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild>
            <Link href="/tickets">My tickets</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/events">Events</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
