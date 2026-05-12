import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");
  return <>{children}</>;
}
