// scripts/cleanup-e2e-events.ts
//
// Deletes events created by the E2E suite (names prefixed "E2E ") plus the
// dependent rows whose FKs do not cascade (purchases, ticket_redemptions).
// Categories, tickets, gate_sessions and event_controllers cascade from the
// event delete.
//
// Run with: npm run e2e:cleanup. Also runs as Playwright global teardown.

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

export async function cleanupE2eEvents(): Promise<number> {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: events, error } = await sb
    .from("events")
    .select("id, name")
    .like("name", "E2E %");
  if (error) throw new Error(error.message);
  if (!events?.length) return 0;

  const ids = events.map((event) => event.id);
  for (const table of ["ticket_redemptions", "purchases"]) {
    const { error: depError } = await sb.from(table).delete().in("event_id", ids);
    if (depError) throw new Error(`${table}: ${depError.message}`);
  }
  const { error: eventError } = await sb.from("events").delete().in("id", ids);
  if (eventError) throw new Error(eventError.message);
  return ids.length;
}

if (process.argv[1]?.endsWith("cleanup-e2e-events.ts")) {
  cleanupE2eEvents()
    .then((count) => console.log(`Deleted ${count} E2E event(s).`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
