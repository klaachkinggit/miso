import { redirect } from "next/navigation";
import { Building2, Compass, Ticket, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getCurrentProfile } from "@/lib/auth";
import {
  EVENT_TYPOLOGY_OPTIONS,
  TICKETING_FOOTPRINT_OPTIONS,
  VOLUME_ESTIMATION_OPTIONS,
} from "@/lib/organizers/profile";
import { chooseStandardUser, startOrganizerOnboarding } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "controller") redirect("/controller");
  if (profile.role === "organizer") redirect("/smartboard");
  if (profile.role === "admin") redirect("/admin");
  const params = await searchParams;

  return (
    <div className="container max-w-5xl py-10">
      <div className="mb-8">
        <p className="mono-stub mb-3 text-primary">Account intent</p>
        <h1 className="text-3xl font-semibold">Choose how you use MISO</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buyer accounts go straight to event discovery. Organizer accounts enter a sandbox Smartboard,
          then unlock publishing after legal and Stripe verification.
        </p>
      </div>

      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass rounded-lg">
          <CardContent className="grid gap-5 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Discover events</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Browse tickets, manage your wallet, and use the official resale exchange.
              </p>
            </div>
            <form action={chooseStandardUser}>
              <Button type="submit" variant="outline" className="w-full">
                Continue as Standard User
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass rounded-lg">
          <CardContent className="grid gap-6 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Organize events</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create draft events immediately. Publishing stays locked until legal identity and
                  Stripe Connect are verified.
                </p>
              </div>
            </div>

            <form action={startOrganizerOnboarding} className="grid gap-5">
              <fieldset className="grid gap-3">
                <legend className="flex items-center gap-2 text-sm font-medium">
                  <Ticket className="h-4 w-4" />
                  Event typology
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EVENT_TYPOLOGY_OPTIONS.map((option) => (
                    <Choice key={option.value} name="event_typology" value={option.value} label={option.label} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">Annual frequency</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VOLUME_ESTIMATION_OPTIONS.map((option) => (
                    <Choice key={option.value} name="volume_estimation" value={option.value} label={option.label} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="flex items-center gap-2 text-sm font-medium">
                  <WalletCards className="h-4 w-4" />
                  Average ticket price
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TICKETING_FOOTPRINT_OPTIONS.map((option) => (
                    <Choice key={option.value} name="ticketing_footprint" value={option.value} label={option.label} />
                  ))}
                </div>
              </fieldset>

              <Button type="submit" className="w-full">Enter Sandbox Smartboard</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Choice({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <Label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border/80 bg-background/40 px-3 py-2 text-sm">
      <input name={name} value={value} type="radio" required className="h-4 w-4" />
      <span>{label}</span>
    </Label>
  );
}
