import { ApiRouteError } from "@/lib/api/errors";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { Profile, UserRole } from "@/types/db";

export async function requireApiUser(): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) throw new ApiRouteError("Authentication required.", 401);
  return user;
}

async function requireApiProfile(params: {
  allowRoles?: UserRole[];
  denyRoles?: UserRole[];
  deniedMessage?: string;
  roleMessage?: string;
} = {}): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new ApiRouteError("Authentication required.", 401);

  if (params.denyRoles?.includes(profile.role)) {
    throw new ApiRouteError(params.deniedMessage ?? "Forbidden.", 403);
  }

  if (params.allowRoles && !params.allowRoles.includes(profile.role)) {
    throw new ApiRouteError(params.roleMessage ?? "Forbidden.", 403);
  }

  return profile;
}

export function requireApiControllerProfile(): Promise<Profile> {
  return requireApiProfile({
    allowRoles: ["controller", "admin"],
    roleMessage: "Controller role required.",
  });
}

export function requireApiNonControllerProfile(deniedMessage: string): Promise<Profile> {
  return requireApiProfile({
    denyRoles: ["controller"],
    deniedMessage,
  });
}
