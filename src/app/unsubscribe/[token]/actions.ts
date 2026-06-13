"use server";

import { redirect } from "next/navigation";

import { unsubscribeByToken } from "@/lib/followers";

// Mutation lives on POST only: GET (page render) must stay side-effect-free so
// email scanners / link prefetchers cannot consume the capability token.
// Idempotent — an already-used or unknown token still lands on the confirmation.
export async function confirmUnsubscribeAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) await unsubscribeByToken(token);
  redirect(`/unsubscribe/${token}?done=1`);
}
