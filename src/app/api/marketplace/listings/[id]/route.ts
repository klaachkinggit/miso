import { NextResponse } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
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
    await cancelResaleListing({ listingId: id, sellerUserId: profile.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Cancel failed." });
  }
}
