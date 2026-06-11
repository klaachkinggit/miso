import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={loginAction} className="grid gap-5">
      <div>
        <p className="eyebrow-signal">Welcome back</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">Log in.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Access your workspace, tickets, and resale listings.
        </p>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="pl-11"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="pl-11"
          />
        </div>
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full">
        Log in <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to MISO?{" "}
        <Link href="/signup" className="font-medium text-signal hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
