import { PageHeader } from "@/components/site/page-header";
import { requireRole } from "@/lib/auth";
import { loadSiteSettings } from "@/lib/site/settings";
import { SiteSettingsForm } from "./site-settings-form";

export default async function SiteSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [params, settings] = await Promise.all([
    searchParams,
    requireRole("admin").then(() => loadSiteSettings()),
  ]);

  return (
    <div className="container py-10">
      <PageHeader
        title="Landing page artwork"
        description="Site media - upload the homepage hero background and organizer-section visuals."
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
      <SiteSettingsForm settings={settings} />
    </div>
  );
}
