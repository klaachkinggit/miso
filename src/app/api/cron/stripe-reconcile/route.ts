import { NextResponse, type NextRequest } from "next/server";
import { cronAuthError } from "@/lib/cron/auth";
import { reconcileStripeEvents } from "@/lib/stripe-marketplace/settlement-sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron (daily): replay recent Stripe events through the webhook
// handler to catch any deliveries the endpoint missed. The handler is
// idempotent, so already-processed events are no-ops.
export async function GET(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;
  try {
    const result = await reconcileStripeEvents();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "reconcile failed",
      },
      { status: 500 },
    );
  }
}
