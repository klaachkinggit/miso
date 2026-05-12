// Role helpers — server-side only.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Profile, UserRole } from "@/types/db";

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const sb = createServiceClient();
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return data ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(role: UserRole | UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}

export async function requireAdmin() {
  return requireRole("admin");
}
