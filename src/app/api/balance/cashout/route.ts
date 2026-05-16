import { NextResponse } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";

export async function POST() {
  try {
    await requireApiNonControllerProfile("Controllers cannot cash out Account Balance.");
  } catch (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ error: "Cashout is not implemented yet." }, { status: 501 });
}
