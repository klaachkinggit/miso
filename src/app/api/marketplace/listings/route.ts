import { NextResponse, type NextRequest } from "next/server";
import { safeErrorMessage } from "@/lib/api/errors";
import { getCurrentProfile } from "@/lib/auth";
import { createResaleListing } from "@/lib/resale/listing";
import { ResellInitSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot use the marketplace." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = ResellInitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid listing request." }, { status: 400 });
    }

    const listing = await createResaleListing({
      ticketId: parsed.data.ticket_id,
      sellerUserId: profile.id,
      price: parsed.data.price,
    });

    return NextResponse.json({ listing });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, { fallback: "Listing failed." }) },
      { status: 400 },
    );
  }
}
