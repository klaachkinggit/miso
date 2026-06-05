import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="container max-w-2xl py-10">
      <div className="mb-8">
        <p className="mono-stub text-[#E6D8C9]/55">Organization setup</p>
        <h1 className="mt-2 text-3xl font-semibold">New ticketing workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Create a separate ticketing business with its own events, team, analytics, and payouts.
        </p>
      </div>

      <Card className="glass rounded-lg">
        <CardContent className="p-6">
          <form action={createOrganization} className="grid gap-5">
            {params?.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
                {params.error}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="name">Organization name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  className="h-11 bg-background/70 pl-10"
                />
              </div>
            </div>
            <Button type="submit" size="lg">
              Create organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
