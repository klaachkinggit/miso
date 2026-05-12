// Lifecycle cron — expires stale reservations, expires past-event sold
// tickets, and closes stale gate sessions.
//
// Run via `pnpm tsx scripts/expire-tickets.ts` from a cron.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { expireStaleGateSessions } from "../src/lib/gates/session";
import type { Ticket } from "../src/types/db";

const PAST_EVENT_GRACE_HOURS = 24;

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function releaseStaleReservations(): Promise<number> {
  const sb = svc();
  const { data } = await sb
    .from("tickets")
    .update({
      status: "available",
      reserved_until: null,
      owner_user_id: null,
      owner_wallet_address: null,
    })
    .eq("status", "reserved")
    .lt("reserved_until", new Date().toISOString())
    .select("id")
    .returns<Pick<Ticket, "id">[]>();
  return data?.length ?? 0;
}

async function expirePastEventTickets(): Promise<number> {
  const sb = svc();
  const cutoff = new Date(Date.now() - PAST_EVENT_GRACE_HOURS * 3600 * 1000).toISOString();

  const { data: pastEvents } = await sb
    .from("events")
    .select("id")
    .lt("date", cutoff)
    .neq("status", "canceled")
    .returns<Array<{ id: string }>>();
  const eventIds = pastEvents?.map((e) => e.id) ?? [];
  if (!eventIds.length) return 0;

  const { data } = await sb
    .from("tickets")
    .update({ status: "expired" })
    .in("event_id", eventIds)
    .eq("status", "sold")
    .select("id")
    .returns<Pick<Ticket, "id">[]>();
  return data?.length ?? 0;
}

async function main() {
  const [reservations, expired, gates] = await Promise.all([
    releaseStaleReservations(),
    expirePastEventTickets(),
    expireStaleGateSessions(),
  ]);
  console.log(JSON.stringify({ reservations, expired_tickets: expired, gates_expired: gates }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
