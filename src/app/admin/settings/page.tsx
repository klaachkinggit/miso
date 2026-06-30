import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/empty-state";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { normalizeOrganizationBranding } from "@/lib/organizations/branding";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { organizationCanAcceptPaidSales } from "@/lib/organizations/payments";
import { organizationStorefrontPath } from "@/lib/organizations/public";
import {
  OrganizationBrandingForm,
  OrganizationOwnershipPanel,
  OrganizationRoyaltyForm,
  OrganizationTeamPanel,
  type OrganizationTeamMember,
} from "./organization-branding-form";
import { createServiceClient } from "@/lib/supabase/service";

export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [params, profile] = await Promise.all([
    searchParams,
    requireOrganizerWorkspace(),
  ]);
  const { activeOrganization } = await getActiveAdminOrganization(profile);

  if (!activeOrganization) {
    return (
      <div className="container py-10">
        <EmptyState
          title="No organization selected"
          description="Create or select an Organization before editing settings."
        />
      </div>
    );
  }

  const branding = normalizeOrganizationBranding(activeOrganization.branding);
  const paymentsReady = organizationCanAcceptPaidSales(activeOrganization);
  const sb = createServiceClient();
  const { data: members, error: membersError } = await sb
    .from("organization_memberships")
    .select("id, role, user_id, profiles(email, display_name)")
    .eq("organization_id", activeOrganization.id)
    .order("created_at", { ascending: true })
    .returns<OrganizationTeamMember[]>();
  if (membersError) throw new Error(membersError.message);

  return (
    <div className="container py-10">
      <header className="mb-10 flex flex-col gap-4 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Workspace · Settings</p>
          <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">
            Settings.
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Control the public storefront identity, team, payouts, and resale
            royalties.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={organizationStorefrontPath(activeOrganization.slug)}>
            <ExternalLink className="h-4 w-4" /> View storefront
          </Link>
        </Button>
      </header>

      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="mb-6 rounded-md border border-signal/40 bg-signal/10 p-3 text-sm text-signal">
          {params.success}
        </div>
      ) : null}

      <section className="mb-10 rounded-md border border-hairline bg-ink-raised p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow-signal">Payments</p>
            <h2 className="display mt-2 text-2xl text-foreground">
              Stripe Connect.
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Paid checkout opens only after this organization has completed
              Stripe onboarding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                activeOrganization.stripe_account_id ? "success" : "outline"
              }
            >
              Account{" "}
              {activeOrganization.stripe_account_id ? "linked" : "missing"}
            </Badge>
            <Badge
              variant={
                activeOrganization.stripe_details_submitted
                  ? "success"
                  : "outline"
              }
            >
              Details{" "}
              {activeOrganization.stripe_details_submitted
                ? "submitted"
                : "pending"}
            </Badge>
            <Badge
              variant={
                activeOrganization.stripe_charges_enabled
                  ? "success"
                  : "outline"
              }
            >
              Charges{" "}
              {activeOrganization.stripe_charges_enabled
                ? "enabled"
                : "blocked"}
            </Badge>
            <Badge variant={paymentsReady ? "signal" : "destructive"}>
              {paymentsReady ? "Ready for paid sales" : "Paid sales blocked"}
            </Badge>
          </div>
        </div>
      </section>
      <OrganizationTeamPanel members={members ?? []} />
      <div className="mt-8">
        <OrganizationOwnershipPanel
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      </div>
      <div className="mt-8">
        <OrganizationBrandingForm
          branding={branding}
          organizationSlug={activeOrganization.slug}
        />
      </div>
      <div className="mt-8">
        <OrganizationRoyaltyForm
          enabled={activeOrganization.resale_royalty_enabled}
          bps={activeOrganization.resale_royalty_bps}
        />
      </div>
    </div>
  );
}
