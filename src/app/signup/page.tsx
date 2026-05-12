import { AuthShell } from "@/components/site/auth-shell";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell>
      <SignupForm error={params?.error} />
    </AuthShell>
  );
}
