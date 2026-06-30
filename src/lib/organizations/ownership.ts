import { audit } from "@/lib/audit";
import {
  findOrInvitePlatformAccount,
  upsertOrganizationMembership,
} from "@/lib/organizations/members";
import { createServiceClient } from "@/lib/supabase/service";
import type { Organization } from "@/types/db";

type OwnershipOrganization = Pick<
  Organization,
  "id" | "name" | "slug" | "stripe_account_id"
>;

export type OrganizationDeletionActivity = {
  events: number;
  purchases: number;
  resaleListings: number;
  customers: number;
};

const EMPTY_DELETION_ACTIVITY: OrganizationDeletionActivity = {
  events: 0,
  purchases: 0,
  resaleListings: 0,
  customers: 0,
};

type OrganizationActivityTable =
  | "events"
  | "purchases"
  | "resale_listings"
  | "organization_customers";

async function countOrganizationRows(
  table: OrganizationActivityTable,
  organizationId: string,
): Promise<number> {
  const sb = createServiceClient();
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countOrganizationDeletionActivity(
  organizationId: string,
): Promise<OrganizationDeletionActivity> {
  const [events, purchases, resaleListings, customers] = await Promise.all([
    countOrganizationRows("events", organizationId),
    countOrganizationRows("purchases", organizationId),
    countOrganizationRows("resale_listings", organizationId),
    countOrganizationRows("organization_customers", organizationId),
  ]);

  return { events, purchases, resaleListings, customers };
}

export function hasOrganizationDeletionActivity(
  activity: OrganizationDeletionActivity,
): boolean {
  return Boolean(
    activity.events ||
    activity.purchases ||
    activity.resaleListings ||
    activity.customers,
  );
}

export function organizationDeletionBlocker(params: {
  organization: OwnershipOrganization;
  confirmedOrganizationId: string;
  confirmedName: string;
  activity: OrganizationDeletionActivity;
}): string | null {
  if (params.confirmedOrganizationId !== params.organization.id) {
    return "Delete request does not match active Organization.";
  }
  if (params.confirmedName !== params.organization.name) {
    return "Type the Organization name exactly to delete it.";
  }
  if (params.organization.stripe_account_id) {
    return "Organization has a Stripe account and cannot be deleted.";
  }
  if (hasOrganizationDeletionActivity(params.activity)) {
    return "Organization has activity and cannot be deleted.";
  }
  return null;
}

export async function transferOrganizationOwnership(params: {
  actorUserId: string;
  organization: OwnershipOrganization;
  recipientEmail: string;
}): Promise<{ recipientUserId: string }> {
  const sb = createServiceClient();
  const recipientUserId = await findOrInvitePlatformAccount(
    params.recipientEmail,
  );

  await upsertOrganizationMembership({
    organizationId: params.organization.id,
    userId: recipientUserId,
    role: "admin",
  });

  const { error } = await sb
    .from("organizations")
    .update({ created_by_user_id: recipientUserId })
    .eq("id", params.organization.id);
  if (error) throw new Error(error.message);

  await audit({
    actorUserId: params.actorUserId,
    action: "organization.transfer",
    entityType: "organization",
    entityId: params.organization.id,
    metadata: {
      recipient_email: params.recipientEmail,
      recipient_user_id: recipientUserId,
      organization_slug: params.organization.slug,
    },
  });

  return { recipientUserId };
}

export async function deleteEmptyOrganization(params: {
  actorUserId: string;
  organization: OwnershipOrganization;
  confirmedOrganizationId: string;
  confirmedName: string;
}): Promise<OrganizationDeletionActivity> {
  const inputBlocker = organizationDeletionBlocker({
    organization: params.organization,
    confirmedOrganizationId: params.confirmedOrganizationId,
    confirmedName: params.confirmedName,
    activity: EMPTY_DELETION_ACTIVITY,
  });
  if (inputBlocker) throw new Error(inputBlocker);

  const activity = await countOrganizationDeletionActivity(
    params.organization.id,
  );
  const blocker = organizationDeletionBlocker({
    organization: params.organization,
    confirmedOrganizationId: params.confirmedOrganizationId,
    confirmedName: params.confirmedName,
    activity,
  });
  if (blocker) throw new Error(blocker);

  const sb = createServiceClient();
  await audit({
    actorUserId: params.actorUserId,
    action: "organization.delete",
    entityType: "organization",
    entityId: params.organization.id,
    metadata: {
      organization_name: params.organization.name,
      organization_slug: params.organization.slug,
    },
  });

  const { error } = await sb
    .from("organizations")
    .delete()
    .eq("id", params.organization.id);
  if (error) throw new Error(error.message);

  return activity;
}
