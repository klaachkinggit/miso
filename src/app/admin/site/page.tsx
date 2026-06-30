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
    <div className="container py-12">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow-signal">Platform · Landing artwork</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          Landing page artwork<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Upload the hero background and organizer-section visuals.
        </p>
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
      <SiteSettingsForm settings={settings} />
    </div>
  );
}
