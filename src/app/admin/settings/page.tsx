import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { normalizeOrganizationBranding } from "@/lib/organizations/branding";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { organizationCanAcceptPaidSales } from "@/lib/organizations/payments";
import { organizationStorefrontPath } from "@/lib/organizations/public";
import {
  OrganizationBrandingForm,
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
  const [params, profile] = await Promise.all([searchParams, requireOrganizerWorkspace()]);
  const { activeOrganization } = await getActiveAdminOrganization(profile);

  if (!activeOrganization) {
    return (
      <div className="container py-10">
        <EmptyState title="No organization selected" description="Create or select an Organization before editing settings." />
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
      <PageHeader
        title="Organization settings"
        description="Control the public billeterie identity buyers see on your Organization storefront."
        actions={
          <Button asChild variant="outline">
            <Link href={organizationStorefrontPath(activeOrganization.slug)}>
              <ExternalLink className="h-4 w-4" /> View storefront
            </Link>
          </Button>
        }
        className="mb-6"
      />
      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {params.success}
        </div>
      ) : null}
      <Card className="glass mb-8 rounded-lg">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Payments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid checkout opens only after this Organization has completed Stripe onboarding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={activeOrganization.stripe_account_id ? "success" : "secondary"}>
              Account {activeOrganization.stripe_account_id ? "linked" : "missing"}
            </Badge>
            <Badge variant={activeOrganization.stripe_details_submitted ? "success" : "secondary"}>
              Details {activeOrganization.stripe_details_submitted ? "submitted" : "pending"}
            </Badge>
            <Badge variant={activeOrganization.stripe_charges_enabled ? "success" : "secondary"}>
              Charges {activeOrganization.stripe_charges_enabled ? "enabled" : "blocked"}
            </Badge>
            <Badge variant={paymentsReady ? "success" : "destructive"}>
              {paymentsReady ? "Ready for paid sales" : "Paid sales blocked"}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <OrganizationTeamPanel members={members ?? []} />
      <OrganizationBrandingForm
        branding={branding}
        organizationSlug={activeOrganization.slug}
      />
      <div className="mt-8">
        <OrganizationRoyaltyForm
          enabled={activeOrganization.resale_royalty_enabled}
          bps={activeOrganization.resale_royalty_bps}
        />
      </div>
    </div>
  );
}
