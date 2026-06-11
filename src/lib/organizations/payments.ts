import { DomainError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/service";
import type { Organization } from "@/types/db";

export type StripeReadyOrganization = Pick<
  Organization,
  "stripe_account_id" | "stripe_charges_enabled" | "stripe_details_submitted"
>;

export function organizationCanAcceptPaidSales(
  organization: StripeReadyOrganization | null | undefined,
): boolean {
  return Boolean(
    organization?.stripe_account_id &&
      organization.stripe_charges_enabled &&
      organization.stripe_details_submitted,
  );
}

export function assertOrganizationCanAcceptPaidSales(
  organization: StripeReadyOrganization | null | undefined,
): void {
  if (organizationCanAcceptPaidSales(organization)) return;
  throw new DomainError("This organization cannot accept paid sales until Stripe onboarding is complete.");
}

// Deep seam: caller passes the organization id (or skip token), the module
// fetches the stripe columns and asserts readiness. Both Purchase settlement
// and Resale settlement consume this — every stripe-readiness gate lands in
// one query, one assertion.
export async function assertOrganizationPaymentReadiness(params: {
  organizationId: string | null | undefined;
  amount: number;
  sb?: ReturnType<typeof createServiceClient>;
}): Promise<void> {
  if (params.amount <= 0) return;
  if (!params.organizationId) return;
  const sb = params.sb ?? createServiceClient();
  const { data: organization, error } = await sb
    .from("organizations")
    .select("stripe_account_id, stripe_charges_enabled, stripe_details_submitted")
    .eq("id", params.organizationId)
    .maybeSingle<StripeReadyOrganization>();
  if (error) throw error;
  assertOrganizationCanAcceptPaidSales(organization);
}

