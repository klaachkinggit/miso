import { NextResponse, type NextRequest } from "next/server";

import { apiErrorResponse } from "@/lib/api/errors";
import {
  constructWebhookEvent,
  handleWebhookEvent,
} from "@/lib/stripe-marketplace/webhook";
import { WebhookSignatureError } from "@/lib/stripe-marketplace/errors";

// Next.js App Router: opt out of body parsing/caching so we can verify
// the raw request body against the Stripe signature header.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return apiErrorResponse(err, { fallback: "Webhook verification failed." });
  }

  try {
    await handleWebhookEvent(event);
  } catch (err) {
    // Log + 500 so Stripe retries. The handler itself is responsible
    // for catching "pending" cases that should NOT trigger a retry
    // (they ack 200 internally by returning early).
    console.error("[stripe-marketplace] webhook handler error", {
      type: event.type,
      id: event.id,
      err,
    });
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
