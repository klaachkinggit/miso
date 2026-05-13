import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { fulfillResale } from "@/lib/resale/listing";
import { createServiceClient } from "@/lib/supabase/service";
import { getRequestOrigin } from "@/lib/url";
import type { ResaleListing, Ticket } from "@/types/db";

const Body = z.object({ listing_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot use the marketplace." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }

    const sb = createServiceClient();
    const { data: listing } = await sb
      .from("resale_listings")
      .select("*")
      .eq("id", parsed.data.listing_id)
      .maybeSingle<ResaleListing>();
    if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (listing.status !== "active") {
      return NextResponse.json({ error: "Listing is not active." }, { status: 400 });
    }
    if (listing.seller_user_id === profile.id) {
      return NextResponse.json({ error: "Cannot buy your own listing." }, { status: 400 });
    }

    const { data: ticket } = await sb
      .from("tickets")
      .select("*")
      .eq("id", listing.ticket_id)
      .maybeSingle<Ticket>();
    if (!ticket) return NextResponse.json({ error: "Ticket missing." }, { status: 400 });
    if (ticket.status !== "listed") {
      return NextResponse.json({ error: `Ticket is ${ticket.status}.` }, { status: 400 });
    }

    const appUrl = getRequestOrigin(request);

    // Mock checkout settles synchronously — run the transfer immediately so
    // the buyer is redirected to a success page with a real DB-paid resale.
    await fulfillResale({ listingId: listing.id, buyerUserId: profile.id });
    return NextResponse.json({
      url: `${appUrl}/marketplace/success?listing_id=${listing.id}&mock=1`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
