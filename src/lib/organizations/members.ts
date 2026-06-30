import { createServiceClient } from "@/lib/supabase/service";
import type { OrganizationRole } from "@/types/db";

export type RemovedOrganizationMember = {
  userId: string;
  role: OrganizationRole;
};

export async function findOrInvitePlatformAccount(
  email: string,
): Promise<string> {
  const sb = createServiceClient();
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (existingProfile?.id) return existingProfile.id;

  const invite = await sb.auth.admin.inviteUserByEmail(email);
  if (invite.error || !invite.data.user) {
    throw new Error(invite.error?.message ?? "Invite could not be sent.");
  }

  const userId = invite.data.user.id;
  const { error: profileError } = await sb.from("profiles").upsert({
    id: userId,
    email,
    display_name: email.split("@")[0],
    role: "user",
  });
  if (profileError) throw new Error(profileError.message);
  return userId;
}

export async function upsertOrganizationMembership(params: {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("organization_memberships").upsert(
    {
      organization_id: params.organizationId,
      user_id: params.userId,
      role: params.role,
    },
    { onConflict: "organization_id,user_id" },
  );
  if (error) throw new Error(error.message);
}

export function shouldInsertControllerMembership(
  existingRole: OrganizationRole | null,
): boolean {
  return existingRole == null;
}

export async function ensureOrganizationControllerMembership(params: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: existingMembership } = await sb
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .maybeSingle<{ role: OrganizationRole }>();

  if (!shouldInsertControllerMembership(existingMembership?.role ?? null))
    return;

  const { error } = await sb.from("organization_memberships").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    role: "controller",
  });
  if (error) throw new Error(error.message);
}

export function organizationMemberRemovalBlocker(params: {
  role: OrganizationRole;
  adminCount: number;
}): string | null {
  if (params.role === "admin" && params.adminCount <= 1) {
    return "Organization needs at least one admin.";
  }
  return null;
}

async function countOrganizationAdmins(
  organizationId: string,
): Promise<number> {
  const sb = createServiceClient();
  const { count, error } = await sb
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function removeOrganizationMembership(params: {
  organizationId: string;
  membershipId: string;
}): Promise<RemovedOrganizationMember> {
  const sb = createServiceClient();
  const { data: membership } = await sb
    .from("organization_memberships")
    .select("id, user_id, role")
    .eq("id", params.membershipId)
    .eq("organization_id", params.organizationId)
    .maybeSingle<{ id: string; user_id: string; role: OrganizationRole }>();
  if (!membership) throw new Error("Team member not found.");

  const adminCount =
    membership.role === "admin"
      ? await countOrganizationAdmins(params.organizationId)
      : 0;
  const blocker = organizationMemberRemovalBlocker({
    role: membership.role,
    adminCount,
  });
  if (blocker) throw new Error(blocker);

  const { error } = await sb
    .from("organization_memberships")
    .delete()
    .eq("id", membership.id)
    .eq("organization_id", params.organizationId);
  if (error) throw new Error(error.message);

  return { userId: membership.user_id, role: membership.role };
}
