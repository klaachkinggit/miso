import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { paymentProvider } from "@/lib/payments";
import { PurchaseInitSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { reserveTicket, releaseReservation } from "@/lib/tickets/reserve";
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
      })
      .select("*")
      .single<Purchase>();
    if (purchaseError || !purchase) throw purchaseError ?? new Error("Purchase could not be created.");
    purchaseId = purchase.id;

    const appUrl = getRequestOrigin(request);
    const provider = paymentProvider();

    const checkout = await provider.createCheckout({
      purchaseId: purchase.id,
      ticketId: ticket.id,
      buyerUserId: profile.id,
      buyerEmail: profile.email,
      eventId: event.id,
      eventName: event.name,
      eventVenue: event.venue_name,
      eventImage: event.image_url,
      categoryName: category.name,
      amount: parseFloat(category.price),
      currency: category.currency,
      successUrl: `${appUrl}/checkout/success?purchase_id=${purchase.id}`,
      cancelUrl: `${appUrl}/checkout/cancel?ticket_id=${ticket.id}&purchase_id=${purchase.id}`,
      webhookUrl: `${appUrl}/api/webhooks/payments`,
    });

    await sb
      .from("purchases")
      .update({
        provider_session_id: checkout.providerSessionId,
        payment_provider: provider.id,
      })
      .eq("id", purchase.id);

    return NextResponse.json({ url: checkout.redirectUrl });
  } catch (error) {
    if (ticketId) await releaseReservation(ticketId);
    if (purchaseId) await sb.from("purchases").update({ status: "failed" }).eq("id", purchaseId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
