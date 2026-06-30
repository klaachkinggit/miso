import { AuthShell } from "@/components/site/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  return (
    <AuthShell>
      <LoginForm error={params?.error} next={params?.next} />
    </AuthShell>
  );
}
