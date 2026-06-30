import { canUseBuyerSurface, getCurrentProfile } from "@/lib/auth";

export async function requireBuyer(message: string) {
  const profile = await getCurrentProfile();
  if (!profile || !canUseBuyerSurface(profile)) throw new Error(message);
  return profile;
}
