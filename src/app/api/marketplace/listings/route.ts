import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { createResaleListing } from "@/lib/resale/listing";
import { ResellInitSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot use the marketplace.",
    );
    const body = await parseJsonBody(request, ResellInitSchema, "Invalid listing request.");

    const listing = await createResaleListing({
      ticketId: body.ticket_id,
      sellerUserId: profile.id,
      price: body.price,
    });

    return NextResponse.json({ listing });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Listing failed." });
  }
}
