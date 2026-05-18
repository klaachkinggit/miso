"use server";

import { redirect } from "next/navigation";
import { defaultRoleDestination } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

function withError(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) withError("/login", "Email and password are required.");

  const sb = await createClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) withError("/login", error.message);

  if (data.user) {
    const service = createServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle<{ role: UserRole }>();
    redirect(defaultRoleDestination(profile?.role));
  }

  redirect("/events");
}
