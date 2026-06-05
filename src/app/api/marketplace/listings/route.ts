import { NextResponse, type NextRequest } from "next/server";
import {
  assertNotOrganizationController,
  requireApiNonControllerProfile,
} from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { getOrganizationIdForTicket } from "@/lib/organizations/auth";
import { createResaleListing } from "@/lib/resale/listing";
import { ResellInitSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot use the marketplace.",
    );
    const body = await parseJsonBody(request, ResellInitSchema, "Invalid listing request.");
    await assertNotOrganizationController({
      profile,
      organizationId: await getOrganizationIdForTicket(body.ticket_id),
      deniedMessage: "Controllers cannot use this organization marketplace.",
    });

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
