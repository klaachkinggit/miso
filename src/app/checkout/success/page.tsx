import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="glass mx-auto w-full max-w-lg rounded-lg">
        <CardContent className="grid gap-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-secondary">
            {paid ? (
              <CheckCircle2 className="h-7 w-7 text-accent" />
            ) : failed ? (
              <XCircle className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7 text-accent" />
            )}
          </div>
          <div>
            <Badge variant={paid ? "success" : failed ? "destructive" : "warning"}>{status}</Badge>
            <h1 className="mt-4 text-2xl font-semibold">
              {paid ? "Ticket is ready" : failed ? "Payment was not completed" : "Payment received, minting ticket"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {paid
                ? "Your digital ticket is now in Wallet."
                : failed
                  ? "The reservation was released. You can try checkout again."
                  : "This page refreshes while we finalise your ticket."}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/tickets">Wallet</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/events">Events</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
