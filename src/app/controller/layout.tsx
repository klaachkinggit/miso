import { requireRole } from "@/lib/auth";

export default async function ControllerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["controller", "admin"]);
  return <>{children}</>;
}
