import { audit } from "@/lib/audit";
import { assertDoorOpsEligible } from "@/lib/organizers/permissions";
import { createServiceClient } from "@/lib/supabase/service";

export async function inviteControllerToEvent(params: {
  eventId: string;
  email: string;
  actorUserId: string;
}): Promise<{ userId: string; invited: boolean }> {
  await assertDoorOpsEligible(params.eventId);

  const sb = createServiceClient();
  const email = params.email.toLowerCase();
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle<{ id: string; role: string }>();

  let userId = existingProfile?.id;
  let invited = false;
  if (!userId) {
    const invite = await sb.auth.admin.inviteUserByEmail(email);
    if (invite.error || !invite.data.user) {
      throw new Error(invite.error?.message ?? "Invite could not be sent.");
    }
    invited = true;
    userId = invite.data.user.id;
    await sb.from("profiles").upsert({
      id: userId,
      email,
      display_name: email.split("@")[0],
      role: "user",
    });
  }

  const { error } = await sb.from("event_controllers").upsert({
    event_id: params.eventId,
    user_id: userId,
  });
  if (error) throw error;

  await audit({
    actorUserId: params.actorUserId,
    action: "controller.invite",
    entityType: "event",
    entityId: params.eventId,
    metadata: { email, user_id: userId, invited },
  });

  return { userId, invited };
}
