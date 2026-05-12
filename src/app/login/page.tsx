import { AuthShell } from "@/components/site/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell>
      <LoginForm error={params?.error} />
    </AuthShell>
  );
}
