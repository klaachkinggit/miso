"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";

function withError(message: string) {
  redirect(`/signup/buyer?error=${encodeURIComponent(message)}`);
}

export async function buyerSignupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!email || !password) withError("Email and password are required.");
  if (password.length < 6) withError("Password must be at least 6 characters.");

  if (!(await enforceRateLimit("auth", await clientIp())).allowed) {
    withError("Too many attempts. Please wait a minute and try again.");
  }

  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName || email.split("@")[0],
      },
    },
  });
  if (error)
    withError(
      "Signup could not be completed. Please check your details and try again.",
    );

  const userId = data?.user?.id;
  if (userId) {
    try {
      await ensureUserWallet(userId, email);
    } catch (err) {
      console.error("ensureUserWallet failed at buyer signup", err);
    }
  }

  redirect("/events");
}
