import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";

// Transactional email is a best-effort side channel. It must NEVER affect
// payments/settlement/refund/publish control flow: every path here is fully
// internally caught and returns instead of throwing. With RESEND_API_KEY or
// EMAIL_FROM unset (local/CI) it is a complete no-op — Resend is never
// constructed and no network call is made.

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cached) cached = new Resend(apiKey);
  return cached;
}

export interface SendResult {
  sent: boolean;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  const resend = getResend();
  if (!resend || !from) return { sent: false };

  try {
    const replyTo = process.env.EMAIL_REPLY_TO;
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      react: input.react,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("[email] resend send error", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false };
  }
}
