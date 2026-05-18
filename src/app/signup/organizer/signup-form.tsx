import Link from "next/link";
import { ArrowRight, Building2, Globe2, LockKeyhole, Mail, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { organizerSignupAction } from "./actions";

export function OrganizerSignupForm({ error }: { error?: string }) {
  return (
    <form action={organizerSignupAction} className="grid gap-5">
      <div>
        <p className="mb-3 text-sm font-medium text-primary">Organizer signup</p>
        <h1 className="text-3xl font-semibold tracking-tight">Set up your ticketing workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tell us about your events. After this, Stripe Connect takes over to verify your business
          and enable payouts.
        </p>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="display_name">Your name</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="display_name" name="display_name" required autoComplete="name" className="h-11 bg-background/70 pl-10" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="organization_name">Organization name</Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="organization_name" name="organization_name" required className="h-11 bg-background/70 pl-10" />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 bg-background/70 pl-10" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-11 bg-background/70 pl-10" />
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
          placeholder="e.g. weekly club nights, a yearly electronic festival, immersive art experiences"
          className="bg-background/70"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="expected_monthly_attendees">Expected monthly attendees</Label>
          <div className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="expected_monthly_attendees"
              name="expected_monthly_attendees"
              type="number"
              min="0"
              className="h-11 bg-background/70 pl-10"
              placeholder="e.g. 500"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <div className="relative">
            <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="country"
              name="country"
              required
              maxLength={2}
              placeholder="FR"
              className="h-11 bg-background/70 pl-10 uppercase"
            />
          </div>
          <p className="text-xs text-muted-foreground">Two-letter ISO code (FR, DE, MA…).</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="website">Website (optional)</Label>
        <Input id="website" name="website" type="url" placeholder="https://" className="h-11 bg-background/70" />
      </div>

      <Button type="submit" size="lg" className="mt-1 w-full">
        Continue to Stripe onboarding <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Buying tickets instead?{" "}
        <Link href="/signup/buyer" className="font-medium text-primary hover:underline">
          Switch to buyer signup
        </Link>
      </p>
    </form>
  );
}
