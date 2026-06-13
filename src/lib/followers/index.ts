import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { OrganizationFollower } from "@/types/db";

export interface ActiveFollower {
  userId: string;
  email: string;
  unsubscribeToken: string;
}

export async function followOrganization(params: {
  organizationId: string;
  userId: string;
}): Promise<OrganizationFollower> {
  const sb = createServiceClient();
  // Idempotent: re-following an org the user already follows resurrects the
  // row (clears unsubscribed_at) and returns the single existing row.
  const { data, error } = await sb
    .from("organization_followers")
    .upsert(
      {
        organization_id: params.organizationId,
        user_id: params.userId,
        unsubscribed_at: null,
      },
      { onConflict: "organization_id,user_id", ignoreDuplicates: false },
    )
    .select("*")
    .single<OrganizationFollower>();
  if (error || !data) throw error ?? new Error("Follow failed");
  return data;
}

export async function unfollowOrganization(params: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("organization_followers")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);
  if (error) throw error;
}

export async function isFollowing(params: {
  organizationId: string;
  userId: string;
}): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organization_followers")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .is("unsubscribed_at", null)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data !== null;
}

// Auto-follow on purchase. Awaited from settlement after the payment is PAID,
// so it must NEVER throw: a follow-row failure cannot roll back a committed
// settlement. Fully internally caught, mirrors notifyWaitlistHead.
export async function ensureAutoFollow(params: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  try {
    const sb = createServiceClient();
    // Only insert; never resurrect an explicit unsubscribe. A buyer who opted
    // out of announcements should not be re-subscribed by a later purchase.
    await sb
      .from("organization_followers")
      .upsert(
        { organization_id: params.organizationId, user_id: params.userId },
        { onConflict: "organization_id,user_id", ignoreDuplicates: true },
      );
  } catch (err) {
    console.error("[followers] ensureAutoFollow failed", err);
  }
}

export async function listActiveFollowerEmails(params: {
  organizationId: string;
}): Promise<ActiveFollower[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organization_followers")
    .select("user_id, unsubscribe_token, profiles(email)")
    .eq("organization_id", params.organizationId)
    .is("unsubscribed_at", null)
    .returns<
      Array<{
        user_id: string;
        unsubscribe_token: string;
        profiles: { email: string | null } | null;
      }>
    >();
  if (error) throw error;
  return (data ?? [])
    .filter((row) => !!row.profiles?.email)
    .map((row) => ({
      userId: row.user_id,
      email: row.profiles!.email!,
      unsubscribeToken: row.unsubscribe_token,
    }));
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organization_followers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data !== null;
}
