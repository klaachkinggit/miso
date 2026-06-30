import { DomainError } from "@/lib/api/errors";
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
  throw new DomainError(
    "This organization cannot accept paid sales until Stripe onboarding is complete.",
  );
}
