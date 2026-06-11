import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { Purchase } from "@/types/db";
import { StatusPoller } from "./status-poller";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string; purchase_id?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const sessionId = params?.session_id;
  const purchaseId = params?.purchase_id;
  const sb = createServiceClient();

  const { data: purchase } = sessionId
    ? await sb
        .from("purchases")
        .select("*")
        .eq("provider_session_id", sessionId)
        .eq("buyer_user_id", user.id)
        .maybeSingle<Purchase>()
    : purchaseId
      ? await sb
          .from("purchases")
          .select("*")
          .eq("id", purchaseId)
          .eq("buyer_user_id", user.id)
          .maybeSingle<Purchase>()
    : { data: null };

  const status = purchase?.status ?? "pending";
  const paid = status === "paid";
  const failed = status === "failed" || status === "refunded";

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <StatusPoller enabled={Boolean(purchase && status === "pending")} />
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
              : "Minting ticket."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {paid
            ? "Your digital ticket is now in your wallet."
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
