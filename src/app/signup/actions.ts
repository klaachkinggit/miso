"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";

function withError(message: string) {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!email || !password) withError("Email and password are required.");
  if (password.length < 6) withError("Password must be at least 6 characters.");

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
  if (error) withError(error.message);

  const userId = data?.user?.id;
  if (userId) {
    try {
      await ensureUserWallet(userId, email);
    } catch (err) {
      console.error("ensureUserWallet failed at signup", err);
    }
  }

  redirect("/events");
}
