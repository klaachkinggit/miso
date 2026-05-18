import { requireOrganizerWorkspace } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOrganizerWorkspace();
  return <>{children}</>;
}
