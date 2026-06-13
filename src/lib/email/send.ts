import "server-only";
import * as React from "react";

import { createServiceClient } from "@/lib/supabase/service";

import { sendTransactionalEmail } from "./client";
import { PurchaseReceipt } from "./templates/PurchaseReceipt";
import { ResaleSoldNotice } from "./templates/ResaleSoldNotice";
import { ResaleBoughtNotice } from "./templates/ResaleBoughtNotice";
import { RefundNotice } from "./templates/RefundNotice";
import { PayoutReady } from "./templates/PayoutReady";
import { EventPublished } from "./templates/EventPublished";

// Every helper here is best-effort and fully internally caught: it never
// throws and never rejects. Callers (settlement/refund/publish/onboarding)
// may `await` these without any risk to their control flow.
//
// All helpers short-circuit BEFORE any DB lookup when email is not
// configured (RESEND_API_KEY / EMAIL_FROM unset), so they are a complete
// no-op in local/CI and never touch the network or `profiles`.

function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3002"
  );
}

async function lookupEmail(userId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data as { email: string | null } | null)?.email ?? null;
}

async function safeSend(
  to: string | null,
  subject: string,
  react: React.ReactElement,
): Promise<void> {
  if (!to) return;
  await sendTransactionalEmail({ to, subject, react });
}

export async function sendPurchaseReceipt(input: {
  buyerUserId: string;
  eventName: string;
  category: string;
  quantity: number;
  amount: string;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.buyerUserId);
    await safeSend(
      to,
      `Your tickets for ${input.eventName}`,
      React.createElement(PurchaseReceipt, {
        eventName: input.eventName,
        category: input.category,
        quantity: input.quantity,
        amount: input.amount,
        ticketsUrl: `${appUrl()}/tickets`,
      }),
    );
  } catch (err) {
    console.error("[email] sendPurchaseReceipt failed", err);
  }
}

export async function sendResaleSoldNotice(input: {
  sellerUserId: string;
  eventName: string;
  listingPrice: string;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.sellerUserId);
    await safeSend(
      to,
      `Your ticket for ${input.eventName} sold`,
      React.createElement(ResaleSoldNotice, {
        eventName: input.eventName,
        listingPrice: input.listingPrice,
      }),
    );
  } catch (err) {
    console.error("[email] sendResaleSoldNotice failed", err);
  }
}

export async function sendResaleBoughtNotice(input: {
  buyerUserId: string;
  eventName: string;
  amount: string;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.buyerUserId);
    await safeSend(
      to,
      `Your resale purchase for ${input.eventName} is confirmed`,
      React.createElement(ResaleBoughtNotice, {
        eventName: input.eventName,
        amount: input.amount,
        ticketsUrl: `${appUrl()}/tickets`,
      }),
    );
  } catch (err) {
    console.error("[email] sendResaleBoughtNotice failed", err);
  }
}

export async function sendRefundNotice(input: {
  buyerUserId: string;
  eventName: string;
  amount: string;
  reason?: string | null;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.buyerUserId);
    await safeSend(
      to,
      `Refund issued for ${input.eventName}`,
      React.createElement(RefundNotice, {
        eventName: input.eventName,
        amount: input.amount,
        reason: input.reason ?? null,
      }),
    );
  } catch (err) {
    console.error("[email] sendRefundNotice failed", err);
  }
}

export async function sendPayoutReadyEmail(input: {
  sellerUserId: string;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.sellerUserId);
    await safeSend(
      to,
      "You're ready to sell on Miso",
      React.createElement(PayoutReady, {
        dashboardUrl: `${appUrl()}/smartboard`,
      }),
    );
  } catch (err) {
    console.error("[email] sendPayoutReadyEmail failed", err);
  }
}

export async function sendEventPublishedEmail(input: {
  organizerUserId: string;
  eventName: string;
  storefrontPath: string;
}): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await lookupEmail(input.organizerUserId);
    await safeSend(
      to,
      `${input.eventName} is now live`,
      React.createElement(EventPublished, {
        eventName: input.eventName,
        storefrontUrl: `${appUrl()}${input.storefrontPath}`,
      }),
    );
  } catch (err) {
    console.error("[email] sendEventPublishedEmail failed", err);
  }
}
