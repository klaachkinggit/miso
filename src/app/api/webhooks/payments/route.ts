// Generic payments webhook. Delegates parsing + signature verification to the
// active PaymentProvider, then applies idempotent DB updates.

import { NextResponse, type NextRequest } from "next/server";
import { isProviderEventProcessed, markProviderEventProcessed } from "@/lib/audit";
import { paymentProvider } from "@/lib/payments";
import { fulfillResale } from "@/lib/resale/listing";
import { createServiceClient } from "@/lib/supabase/service";
import { fulfillPurchase, StaleReservationError } from "@/lib/tickets/mint";
import { releaseReservation } from "@/lib/tickets/reserve";
import type { Purchase } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function failPurchase(args: {
  ticketId?: string | null;
  purchaseId?: string | null;
  providerPaymentId?: string | null;
}) {
  const sb = createServiceClient();
  if (args.ticketId) await releaseReservation(args.ticketId);
  if (args.purchaseId) {
    await sb
      .from("purchases")
      .update({
        status: "failed",
        provider_payment_id: args.providerPaymentId ?? null,
      })
      .eq("id", args.purchaseId);
  }
}

async function loadPurchase(args: {
  purchaseId: string | null;
  providerSessionId: string | null;
}): Promise<Purchase | null> {
  const sb = createServiceClient();
  if (args.purchaseId) {
    const { data } = await sb
      .from("purchases")
      .select("*")
      .eq("id", args.purchaseId)
      .maybeSingle<Purchase>();
    if (data) return data;
  }
  if (args.providerSessionId) {
    const { data } = await sb
      .from("purchases")
      .select("*")
      .eq("provider_session_id", args.providerSessionId)
      .maybeSingle<Purchase>();
    if (data) return data;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const provider = paymentProvider();

  let event;
  try {
    event = await provider.parseWebhook({ body, headers: request.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook" },
      { status: 400 },
    );
  }

  if (event.kind === "ignored") {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (await isProviderEventProcessed(provider.id, event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const purchase = await loadPurchase({
      purchaseId: event.purchaseId,
      providerSessionId: event.providerSessionId,
    });

    if (event.kind === "payment.succeeded" && purchase) {
      const sb = createServiceClient();
      await sb
        .from("purchases")
        .update({ provider_payment_id: event.providerPaymentId })
        .eq("id", purchase.id);

      try {
        // Primary purchases mint on success; resale purchases just transfer.
        if (purchase.ticket_id) {
          await fulfillPurchase({
            ticketId: purchase.ticket_id,
            buyerUserId: purchase.buyer_user_id,
            purchaseId: purchase.id,
          });
        }
      } catch (error) {
        if (error instanceof StaleReservationError) {
          await failPurchase({
            ticketId: purchase.ticket_id,
            purchaseId: purchase.id,
            providerPaymentId: event.providerPaymentId,
          });
          if (event.providerPaymentId) {
            await provider.refund({ providerPaymentId: event.providerPaymentId });
          }
        } else {
          throw error;
        }
      }
    }

    if (event.kind === "payment.failed" || event.kind === "payment.expired") {
      await failPurchase({
        ticketId: purchase?.ticket_id ?? null,
        purchaseId: purchase?.id ?? null,
        providerPaymentId: event.providerPaymentId,
      });
    }

    if (event.kind === "refund.succeeded" && purchase) {
      // The admin refund flow already marks DB state. This branch is here to
      // close the loop when the provider initiates the refund out-of-band.
      const sb = createServiceClient();
      await sb.from("purchases").update({ status: "refunded" }).eq("id", purchase.id);
    }

    // Optional resale-leg dispatch (no-op for now; mock provider fulfills inline).
    void fulfillResale;

    await markProviderEventProcessed(provider.id, event.id, { kind: event.kind });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Payments webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
