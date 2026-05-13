import crypto from "node:crypto";
import Link from "next/link";
import { CalendarPlus, Settings, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateShort } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Profile } from "@/types/db";
import { adminTopupAccountBalance } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const sb = createServiceClient();
  const [{ data: events }, { data: holders }] = await Promise.all([
    sb.from("events").select("*").order("created_at", { ascending: false }).returns<EventRow[]>(),
    sb
      .from("profiles")
      .select("*")
      .neq("role", "controller")
      .order("email", { ascending: true })
      .returns<Profile[]>(),
  ]);

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Admin</h1>
          <p className="mt-2 text-muted-foreground">Create events, manage inventory, invite controllers, and refund tickets.</p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <CalendarPlus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>
      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {params.success}
        </div>
      ) : null}

      <Card className="glass mb-8 rounded-lg">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Account Balance top-up</h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Grant demo credit to buyer or admin profiles. Controllers are excluded.
            </p>
          </div>
          <form action={adminTopupAccountBalance} className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_1fr_auto] md:items-end">
            <input type="hidden" name="topup_request_id" value={crypto.randomUUID()} />
            <input type="hidden" name="currency" value="MAD" />
            <div className="space-y-2">
              <Label htmlFor="profile_id">Holder</Label>
              <select
                id="profile_id"
                name="profile_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm"
              >
                <option value="">Select holder</option>
                {(holders ?? []).map((holder) => (
                  <option key={holder.id} value={holder.id}>
                    {holder.email} ({holder.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <input
                id="currency"
                value="MAD"
                disabled
                className="flex h-10 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="250.00" />
            </div>
            <Button type="submit" className="w-full md:w-auto">Top up</Button>
          </form>
        </CardContent>
      </Card>

      {events?.length ? (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id} className="glass rounded-lg">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{event.name}</h2>
                    <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
                    {!event.solana_collection_address ? <Badge variant="warning">collection pending</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(event.date)} at {event.venue_name}, {event.city}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${event.id}`}>
                    <Settings className="h-4 w-4" />
                    Manage
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No events yet" description="Create the first event and mint its Solana collection.">
          <Button asChild>
            <Link href="/admin/events/new">Create event</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
