import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganization } from "../../actions";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container max-w-2xl py-16">
      <div className="mb-10">
        <p className="eyebrow-signal">Organization setup</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          New ticketing<br />
          <span className="display-italic">workspace.</span>
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          A separate ticketing business with its own events, team, analytics, and payouts.
        </p>
      </div>

      <div className="rounded-md border border-hairline bg-ink-raised p-8">
        <form action={createOrganization} className="grid gap-6">
          {params?.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {params.error}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="name">Organization name</Label>
            <div className="relative">
              <Building2
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={160}
                className="pl-11"
              />
            </div>
          </div>
          <Button type="submit" size="lg">
            Create organization
          </Button>
        </form>
      </div>
    </div>
  );
}
