import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function HomePage() {
  const sb = createServiceClient();
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");

  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true })
    .limit(6)
    .returns<EventRow[]>();

  return (
    <div>
      <section className="container grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <div className="mb-4 flex w-fit items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Tickets that cannot be copied or screenshotted
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
            Buy a ticket. Tap your phone at the door.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Pay with your card. Your ticket lives on your phone and proves itself at entry — no screenshots, no forwarded PDFs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/events">
                Browse events <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {profile ? (
              <>
                <Button asChild variant="outline" size="lg">
                  <Link href="/tickets">My tickets</Link>
                </Button>
                {profile.role === "admin" ? (
                  <Button asChild variant="outline" size="lg">
                    <Link href="/admin">Admin dashboard</Link>
                  </Button>
                ) : null}
                {profile.role === "admin" ? (
                  <Button asChild variant="outline" size="lg">
                    <Link href="/controller">Controller dashboard</Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <Button asChild variant="outline" size="lg">
                <Link href="/signup">Create account</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="grid content-center gap-4">
          <Card className="glass rounded-lg">
            <CardContent className="grid gap-4 p-6">
              {[
                ["Familiar checkout", "Pay with your card. No wallet setup needed."],
                ["Phone-bound ticket", "Each ticket is tied to your account and cannot be copied or screenshotted."],
                ["Tap to enter", "Open your ticket at the gate and let the staff scan it. Fast and tamper-proof."],
              ].map(([title, description], index) => (
                <div key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                    {index === 0 ? <Ticket className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Featured events</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published events ready for checkout.</p>
          </div>
          <Button asChild variant="ghost">
            <Link href="/events">View all</Link>
          </Button>
        </div>
        {events?.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState title="No published events yet" description="Admin-created events will appear here after publishing." />
        )}
      </section>
    </div>
  );
}
