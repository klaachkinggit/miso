import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buyerSignupAction } from "./actions";

export function BuyerSignupForm({ error }: { error?: string }) {
  return (
    <form action={buyerSignupAction} className="grid gap-6">
      <div>
        <p className="eyebrow-signal">Buyer signup</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          Create your
          <br />
          <span className="display-italic">account.</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Buy tickets and keep every digital pass ready on your phone.
        </p>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Field
        icon={UserRound}
        label="Name"
        name="display_name"
        autoComplete="name"
      />
      <Field
        icon={Mail}
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        icon={LockKeyhole}
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      <Button type="submit" size="lg" className="mt-2 w-full">
        Create account <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Running events?{" "}
        <Link
          href="/signup/organizer"
          className="font-medium text-signal hover:underline"
        >
          Organizer signup
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-signal hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

type FieldProps = {
  icon: LucideIcon;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
};

function Field({ icon: Icon, label, name, ...rest }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input id={name} name={name} className="pl-11" {...rest} />
      </div>
    </div>
  );
}
