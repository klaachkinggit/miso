import { NextResponse, type NextRequest } from "next/server";
import { cronAuthError } from "@/lib/cron/auth";
import { reDriveStuckPayments } from "@/lib/stripe-marketplace/settlement-sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron: re-drive marketplace payments whose settlement lease expired
// (a webhook runner crashed mid-fulfillment/transfer).
export async function GET(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;
  try {
    const result = await reDriveStuckPayments();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "settlement sweep failed",
      },
      { status: 500 },
    );
  }
}
