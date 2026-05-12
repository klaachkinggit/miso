import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { cancelResaleListing } from "@/lib/resale/listing";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot use the marketplace." }, { status: 403 });
  }

  try {
    const { id } = await params;
    await cancelResaleListing({ listingId: id, sellerUserId: profile.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cancel failed." },
      { status: 400 },
    );
  }
}
