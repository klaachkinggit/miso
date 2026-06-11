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
    <div className="min-h-[calc(100vh-4rem)] border-b border-hairline">
      <div className="sticky top-16 z-30 border-b border-hairline bg-background/80 backdrop-blur-xl">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            <NavLink href="/admin" icon={LayoutDashboard} label="Dashboard" />
            {hasOrganization ? (
              <>
                <NavLink href="/admin/events" icon={CalendarDays} label="Events" />
                <NavLink href="/admin/settings" icon={Settings} label="Settings" />
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {hasOrganization ? (
              <form action={switchOrganization} className="flex items-center gap-2">
                <label htmlFor="organization_id" className="sr-only">
                  Active organization
                </label>
                <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                <select
                  id="organization_id"
                  name="organization_id"
                  defaultValue={activeOrganization?.id}
                  className="h-9 min-w-56 rounded-md border border-hairline bg-ink-soft/60 px-3 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
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
            <Button asChild size="sm" variant={hasOrganization ? "outline" : "default"}>
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

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
