import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { releaseReservation } from "@/lib/tickets/lifecycle";
import type { Ticket } from "@/types/db";

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket_id?: string; purchase_id?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sb = createServiceClient();

  if (params?.ticket_id) {
    const { data: ticket } = await sb
      .from("tickets")
      .select("*")
      .eq("id", params.ticket_id)
      .maybeSingle<Ticket>();
    if (ticket?.status === "reserved" && ticket.owner_user_id === user.id) {
      await releaseReservation(ticket.id);
    }
  }

  if (params?.purchase_id) {
    await sb
      .from("purchases")
      .update({ status: "failed" })
      .eq("id", params.purchase_id)
      .eq("buyer_user_id", user.id)
      .eq("status", "pending");
  }

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-12">
      <Card className="glass mx-auto w-full max-w-lg rounded-lg">
        <CardContent className="grid gap-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-secondary">
            <XCircle className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Checkout canceled</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your reservation was released if it was still pending.
            </p>
          </div>
          <Button asChild>
            <Link href="/events">Back to events</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
