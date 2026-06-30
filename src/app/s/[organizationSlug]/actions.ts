"use server";

import { revalidatePath } from "next/cache";

import { followOrganization, unfollowOrganization } from "@/lib/followers";
import { getActiveOrganizationBySlug } from "@/lib/organizations/public";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireBuyer } from "./buyer";

// Resolve the org server-side from the slug the buyer was shown — never trust
// a client-supplied organizationId, or an authenticated user could seed
// follower rows on arbitrary organizations.
async function resolveVisibleOrganizationId(
  organizationSlug: string,
): Promise<string> {
  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) throw new Error("Organizer not found.");
  return organization.id;
}

export async function followOrganizationAction(input: {
  organizationSlug: string;
}): Promise<void> {
  const profile = await requireBuyer("Sign in to follow this organizer.");
  const { allowed } = await enforceRateLimit("follow", profile.id);
  if (!allowed)
    throw new Error("Too many follow changes. Slow down and try again.");
  const organizationId = await resolveVisibleOrganizationId(
    input.organizationSlug,
  );
  await followOrganization({ organizationId, userId: profile.id });
  revalidatePath(`/s/${input.organizationSlug}`);
}

export async function unfollowOrganizationAction(input: {
  organizationSlug: string;
}): Promise<void> {
  const profile = await requireBuyer("Sign in to follow this organizer.");
  const { allowed } = await enforceRateLimit("follow", profile.id);
  if (!allowed)
    throw new Error("Too many follow changes. Slow down and try again.");
  const organizationId = await resolveVisibleOrganizationId(
    input.organizationSlug,
  );
  await unfollowOrganization({ organizationId, userId: profile.id });
  revalidatePath(`/s/${input.organizationSlug}`);
}
