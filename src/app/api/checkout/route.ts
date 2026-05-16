import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/api/errors";
import {
  FulfillmentPendingError,
  settleFailedPurchase,
  settlePaidPurchase,
} from "@/lib/payments/settlement";
import { PurchaseInitSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket } from "@/lib/tickets/lifecycle";
import { getRequestOrigin } from "@/lib/url";
import type { EventRow, Purchase } from "@/types/db";

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot purchase tickets." }, { status: 403 });
  }

  let ticketId: string | undefined;
  let purchaseId: string | undefined;
  const sb = createServiceClient();

  try {
    const body = await request.json();
    const parsed = PurchaseInitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }

    // Idempotency: clients can submit `Idempotency-Key` and we'll
    // return the original purchase's success URL on retry. Without
    // the header the route is non-idempotent (back-compat).
    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    if (idempotencyKey) {
      const { data: prior } = await sb
        .from("purchases")
        .select("id, status")
        .eq("buyer_user_id", profile.id)
        .eq("provider_session_id", idempotencyKey)
        .maybeSingle<{ id: string; status: string }>();
      if (prior) {
        const appUrl = getRequestOrigin(request);
        return NextResponse.json(
          {
            url: `${appUrl}/checkout/success?purchase_id=${prior.id}`,
            status: prior.status,
          },
          { status: prior.status === "paid" ? 200 : 202 },
        );
      }
    }

    const { ticket, category } = await reserveTicket({
      categoryId: parsed.data.category_id,
      buyerUserId: profile.id,
    });
    ticketId = ticket.id;

    const { data: event } = await sb
      .from("events")
      .select("*")
      .eq("id", ticket.event_id)
      .single<EventRow>();
    if (!event) throw new Error("Event not found.");

    const { data: purchase, error: purchaseError } = await sb
      .from("purchases")
      .insert({
        buyer_user_id: profile.id,
        event_id: event.id,
        ticket_id: ticket.id,
        amount: category.price,
        currency: category.currency,
        status: "pending",
        provider_session_id: idempotencyKey ?? null,
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) throw purchaseError ?? new Error("Purchase could not be created.");
    purchaseId = purchase.id;

    const appUrl = getRequestOrigin(request);
    await settlePaidPurchase({ purchaseId: purchase.id });

    return NextResponse.json({ url: `${appUrl}/checkout/success?purchase_id=${purchase.id}` });
  } catch (error) {
    if (error instanceof FulfillmentPendingError) {
      return NextResponse.json(
        {
          error:
            "Your purchase is pending on chain. We're retrying — check back shortly.",
          status: "pending",
        },
        { status: 202 },
      );
    }
    await settleFailedPurchase({ ticketId, purchaseId });
    return NextResponse.json(
      { error: safeErrorMessage(error, { fallback: "Checkout failed." }) },
      { status: 400 },
    );
  }
}
