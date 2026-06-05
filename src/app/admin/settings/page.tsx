import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { normalizeOrganizationBranding } from "@/lib/organizations/branding";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { organizationStorefrontPath } from "@/lib/organizations/public";
import { OrganizationBrandingForm } from "./organization-branding-form";

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
      <OrganizationBrandingForm
        branding={branding}
        organizationSlug={activeOrganization.slug}
      />
    </div>
  );
}
