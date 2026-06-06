import { createServiceClient } from "@/lib/supabase/service";
import type { OrganizationRole } from "@/types/db";

export async function findOrInvitePlatformAccount(email: string): Promise<string> {
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

export function shouldInsertControllerMembership(existingRole: OrganizationRole | null): boolean {
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

  if (!shouldInsertControllerMembership(existingMembership?.role ?? null)) return;

  const { error } = await sb.from("organization_memberships").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    role: "controller",
  });
  if (error) throw new Error(error.message);
}
