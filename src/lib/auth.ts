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

export async function requireOrganizerWorkspace() {
  return requireRole(["admin", "organizer"]);
}

export function isGlobalAdmin(profile: Pick<Profile, "role">): boolean {
  return profile.role === "admin";
}

export function canUseOrganizerWorkspace(profile: Pick<Profile, "role">): boolean {
  return profile.role === "admin" || profile.role === "organizer";
}

export function canOperateGateRole(profile: Pick<Profile, "role">): boolean {
  return profile.role === "admin" || profile.role === "controller";
}

// Where a signed-in user should land instead of seeing /login or /signup
// again. Controllers go to the gate UI; admins and organizers go to
// the organizer workspace; everyone else goes to the buyer event feed.
export function defaultRoleDestination(role: UserRole | null | undefined): string {
  if (role === "controller") return "/controller";
  if (role === "admin" || role === "organizer") return "/admin";
  return "/events";
}

// Redirects already-authenticated users away from auth-only pages
// (/signup, /login). Returns silently when there is no session.
export async function redirectIfAuthenticated(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  redirect(defaultRoleDestination(profile.role));
}
