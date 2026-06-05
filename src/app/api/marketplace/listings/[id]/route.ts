import { NextResponse } from "next/server";
import {
  assertNotOrganizationController,
  requireApiNonControllerProfile,
} from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { getOrganizationIdForListing } from "@/lib/organizations/auth";
import { cancelResaleListing } from "@/lib/resale/listing";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot use the marketplace.",
    );
    const { id } = await params;
    await assertNotOrganizationController({
      profile,
      organizationId: await getOrganizationIdForListing(id),
      deniedMessage: "Controllers cannot use this organization marketplace.",
    });
    await cancelResaleListing({ listingId: id, sellerUserId: profile.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Cancel failed." });
  }
}
