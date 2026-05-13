// scripts/seed.ts
//
// Seeds a fully working demo against a local Supabase stack.
// Idempotent: re-running upserts the same fixtures.
//
// Creates:
//   - admin@miso.local       password: misoadmin
//   - buyer@miso.local       password: misobuyer
//   - controller@miso.local  password: misocontroller
//   - one published event ("Miso Demo Night") with two categories
//   - 5 GA + 3 VIP tickets seeded as `available`
//
// Run with: npm run demo:seed.
// The script loads .env.local itself, matching the Next.js runtime.

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local before running.",
  );
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface SeedUser {
  email: string;
  password: string;
  display_name: string;
  role: "admin" | "user" | "controller";
}

const users: SeedUser[] = [
  { email: "admin@miso.local", password: "misoadmin", display_name: "Demo Admin", role: "admin" },
  { email: "buyer@miso.local", password: "misobuyer", display_name: "Demo Buyer", role: "user" },
  { email: "controller@miso.local", password: "misocontroller", display_name: "Demo Controller", role: "controller" },
];

async function ensureUser(user: SeedUser): Promise<string> {
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (existing) {
    await sb
      .from("profiles")
      .update({ display_name: user.display_name, role: user.role })
      .eq("id", existing.id);
    return existing.id;
  }

  const created = await sb.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.display_name },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Failed to create auth user ${user.email}: ${created.error?.message}`);
  }
  const userId = created.data.user.id;
  await sb.from("profiles").upsert({
    id: userId,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  });
  return userId;
}

async function ensureEvent(adminId: string): Promise<string> {
  const name = "Miso Demo Night";
  const { data: existing } = await sb
    .from("events")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    await sb
      .from("events")
      .update({
        sales_enabled: true,
        resale_enabled: true,
        status: "published",
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("events")
    .insert({
      name,
      date: inTwoWeeks,
      venue_name: "Demo Hall",
      city: "Casablanca",
      capacity: 100,
      description: "Demo event seeded by scripts/seed.ts.",
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: true,
      status: "published",
      // Set demo collection address so checkout works without minting a real collection.
      solana_collection_address: `demo_collection_${adminId.slice(0, 8)}`,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create event: ${error?.message}`);
  return data.id;
}

async function ensureCategoryWithTickets(args: {
  eventId: string;
  name: string;
  price: number;
  supply: number;
  currency: "MAD" | "EUR";
}) {
  const { data: existing } = await sb
    .from("ticket_categories")
    .select("id")
    .eq("event_id", args.eventId)
    .eq("name", args.name)
    .maybeSingle();
  if (existing) {
    await sb
      .from("ticket_categories")
      .update({ resale_enabled: true })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: category, error } = await sb
    .from("ticket_categories")
    .insert({
      event_id: args.eventId,
      name: args.name,
      price: args.price,
      currency: args.currency,
      supply: args.supply,
      resale_enabled: true,
    })
    .select("id")
    .single();
  if (error || !category) throw new Error(`Failed to create category ${args.name}: ${error?.message}`);

  const { data: lastTicket } = await sb
    .from("tickets")
    .select("serial_number")
    .eq("event_id", args.eventId)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ serial_number: number }>();
  const offset = lastTicket?.serial_number ?? 0;

  const ticketRows = Array.from({ length: args.supply }, (_, index) => ({
    event_id: args.eventId,
    category_id: category.id,
    serial_number: offset + index + 1,
    status: "available" as const,
  }));
  const { error: ticketsErr } = await sb.from("tickets").insert(ticketRows);
  if (ticketsErr) throw new Error(`Failed to seed tickets: ${ticketsErr.message}`);

  return category.id;
}

async function ensureController(eventId: string, controllerUserId: string) {
  await sb
    .from("event_controllers")
    .upsert({ event_id: eventId, user_id: controllerUserId });
}

async function main() {
  console.log(`Seeding against ${supabaseUrl}`);
  const userIds: Record<string, string> = {};
  for (const user of users) {
    userIds[user.email] = await ensureUser(user);
    console.log(`  user ${user.email} → ${userIds[user.email]}`);
  }

  const eventId = await ensureEvent(userIds["admin@miso.local"]);
  console.log(`  event ${eventId}`);

  await ensureCategoryWithTickets({ eventId, name: "General", price: 150, supply: 5, currency: "MAD" });
  await ensureCategoryWithTickets({ eventId, name: "VIP", price: 400, supply: 3, currency: "MAD" });
  console.log("  categories + tickets seeded");

  await ensureController(eventId, userIds["controller@miso.local"]);
  console.log("  controller assigned");

  console.log("\nDone. Demo credentials:");
  for (const user of users) {
    console.log(`  ${user.role.padEnd(11)}  ${user.email}  /  ${user.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
