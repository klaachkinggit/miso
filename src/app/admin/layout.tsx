import Link from "next/link";
import { Building2, CalendarDays, LayoutDashboard, Plus, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { switchOrganization } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireOrganizerWorkspace();
  const { organizations, activeOrganization } = await getActiveAdminOrganization(profile);
  const hasOrganization = organizations.length > 0;

  return (
    <div>
      <div className="border-b border-border/70 bg-background/80">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
            {hasOrganization ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/events">
                    <CalendarDays className="h-4 w-4" /> Events
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/settings">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {hasOrganization ? (
              <form action={switchOrganization} className="flex items-center gap-2">
                <label htmlFor="organization_id" className="sr-only">
                  Active organization
                </label>
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <select
                  id="organization_id"
                  name="organization_id"
                  defaultValue={activeOrganization?.id}
                  className="h-9 min-w-56 rounded-md border border-input bg-background/70 px-3 text-sm"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm" aria-label="Switch organization">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </form>
            ) : null}
            <Button asChild size="sm" variant={hasOrganization ? "default" : "outline"}>
              <Link href="/admin/organizations/new">
                <Plus className="h-4 w-4" /> New organization
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
