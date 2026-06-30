import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Globe2,
  LockKeyhole,
  Mail,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { organizerSignupAction } from "./actions";
import { StepIndicator } from "./step-indicator";

export function OrganizerSignupForm({ error }: { error?: string }) {
  return (
    <form action={organizerSignupAction} className="grid gap-6">
      <div>
        <StepIndicator current={1} />
        <h1 className="display mt-5 text-4xl text-foreground md:text-5xl">
          Create your
          <br />
          <span
            className="display-italic"
            style={{ color: "hsl(var(--signal))" }}
          >
            organization.
          </span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Tell us about your business. Next we&apos;ll hook up Stripe Connect,
          then publish your first event.
        </p>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FieldWithIcon
          icon={UserRound}
          label="Your name"
          name="display_name"
          required
          autoComplete="name"
        />
        <FieldWithIcon
          icon={Building2}
          label="Organization name"
          name="organization_name"
          required
        />
      </div>

      <FieldWithIcon
        icon={Mail}
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <LockKeyhole
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="pl-11"
          />
        </div>
        <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event_types">What kind of events do you run?</Label>
        <Textarea
          id="event_types"
          name="event_types"
          rows={3}
          required
          placeholder="weekly club nights, an annual electronic festival, immersive art experiences…"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FieldWithIcon
          icon={Users}
          label="Expected monthly attendees"
          name="expected_monthly_attendees"
          type="number"
          min="0"
          placeholder="e.g. 500"
        />
        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <div className="relative">
            <Globe2
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="country"
              name="country"
              required
              maxLength={2}
              placeholder="FR"
              className="pl-11 uppercase tracking-[0.2em]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ISO 3166-1 alpha-2 (FR, DE, MA…).
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="website">Website (optional)</Label>
        <Input id="website" name="website" type="url" placeholder="https://" />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full">
        Continue to Stripe onboarding <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Just here to buy tickets?{" "}
        <Link
          href="/signup/buyer"
          className="font-medium text-signal hover:underline"
        >
          Buyer signup
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
  placeholder?: string;
  min?: string;
};

function FieldWithIcon({ icon: Icon, label, name, ...rest }: FieldProps) {
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
