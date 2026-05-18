import { AuthShell } from "@/components/site/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";
import { BuyerSignupForm } from "./signup-form";

export default async function BuyerSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  return (
    <AuthShell>
      <BuyerSignupForm error={params?.error} />
    </AuthShell>
  );
}
