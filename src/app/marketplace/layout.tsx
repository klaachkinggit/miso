import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  redirectIfCannotUseBuyerSurface(profile);
  return <>{children}</>;
}
