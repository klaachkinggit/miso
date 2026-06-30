"use server";

import { redirect } from "next/navigation";
import { defaultRoleDestination } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import type { UserRole } from "@/types/db";

function internalPath(value: FormDataEntryValue | null): string | null {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

function withError(path: string, message: string, next: string | null) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  redirect(`${path}?${params}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = internalPath(formData.get("next"));

  if (!email || !password)
    withError("/login", "Email and password are required.", next);

  if (!(await enforceRateLimit("auth", await clientIp())).allowed) {
    withError(
      "/login",
      "Too many attempts. Please wait a minute and try again.",
      next,
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error)
    withError("/login", "Login failed. Check your email and password.", next);

  if (data.user) {
    const service = createServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle<{ role: UserRole }>();
    redirect(next ?? defaultRoleDestination(profile?.role));
  }

  redirect("/events");
}
