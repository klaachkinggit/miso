import { getCurrentProfile } from "@/lib/auth";
import { getMemberOrganizationIds } from "@/lib/organizations/auth";
import { redirect } from "next/navigation";

export default async function ControllerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin" || profile.role === "controller") return <>{children}</>;
  const organizationIds = await getMemberOrganizationIds(profile.id);
  if (!organizationIds.length) redirect("/");
  return <>{children}</>;
}
