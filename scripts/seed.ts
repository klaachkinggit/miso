// scripts/seed.ts
//
// Seeds a fully working demo against a local Supabase stack.
// Re-runnable: upserts fixtures and restores available demo inventory.
//
// Demo accounts:
//   - buyer@miso.local       password: misobuyer
//   - organizer@miso.local   password: misoorganizer
//   - admin@miso.local       password: misoadmin
//
// Fixture accounts for resale/controller e2e coverage are also seeded, but
// they are not shown as primary demo credentials.
//
// Creates:
//   - published events across tonight, this week, weekend, and next month
//   - NFT ticket tiers seeded as `available`
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
  role: "admin" | "organizer" | "user" | "controller";
  demoLabel?: "buyer" | "organizer" | "admin";
}

type DemoSeedUser = SeedUser & { demoLabel: "buyer" | "organizer" | "admin" };

const demoUsers: DemoSeedUser[] = [
  { email: "buyer@miso.local", password: "misobuyer", display_name: "Demo Buyer", role: "user", demoLabel: "buyer" },
  {
    email: "organizer@miso.local",
    password: "misoorganizer",
    display_name: "Demo Organizer",
    role: "organizer",
    demoLabel: "organizer",
  },
  { email: "admin@miso.local", password: "misoadmin", display_name: "Demo Admin", role: "admin", demoLabel: "admin" },
];

const fixtureUsers: SeedUser[] = [
  { email: "seller@miso.local", password: "misoseller", display_name: "Demo Seller", role: "user" },
  { email: "controller@miso.local", password: "misocontroller", display_name: "Demo Controller", role: "controller" },
];

const users: SeedUser[] = [...demoUsers, ...fixtureUsers];

interface SeedEvent {
  name: string;
  date: Date;
  venue_name: string;
  city: string;
  capacity: number;
  description: string;
  categories: Array<{
    name: string;
    description: string;
    benefits: string;
    price: number;
    supply: number;
  }>;
}

function atTime(base: Date, hour: number, minute = 0) {
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function nextWeekday(base: Date, weekday: number, minimumDaysAway = 1) {
  const today = base.getDay();
  let days = (weekday - today + 7) % 7;
  if (days < minimumDaysAway) days += 7;
  return addDays(base, days);
}

function nextMonthDate(base: Date, dayOfMonth: number, hour: number, minute = 0) {
  return new Date(base.getFullYear(), base.getMonth() + 1, dayOfMonth, hour, minute, 0, 0);
}

function buildSeedEvents(): SeedEvent[] {
  const now = new Date();
  const tonight = atTime(now, 20, 30);
  if (tonight <= now) tonight.setTime(now.getTime() + 2 * 60 * 60 * 1000);
  const weekend = atTime(nextWeekday(now, 6, 0), 22, 0);
  if (weekend <= now) weekend.setDate(weekend.getDate() + 7);

  return [
    {
      name: "Midnight Frequency",
      date: tonight,
      venue_name: "Concrete",
      city: "Paris",
      capacity: 900,
      description: "A members-only electronic night with cinematic lighting, token-gated access, and collectible NFT tickets.",
      categories: [
        {
          name: "General NFT",
          description: "Entry ticket minted to your event wallet.",
          benefits: "QR check-in, NFT proof of attendance, and official resale eligibility.",
          price: 18,
          supply: 36,
        },
        {
          name: "Gold Circle",
          description: "Premium floor access with a limited collectible design.",
          benefits: "Priority entry, collector artwork, and member-only bar access.",
          price: 52,
          supply: 12,
        },
      ],
    },
    {
      name: "Berlin Boiler Set",
      date: atTime(addDays(now, 2), 23, 0),
      venue_name: "Tresor",
      city: "Berlin",
      capacity: 650,
      description: "A raw warehouse performance with premium access control and anti-scalping resale limits.",
      categories: [
        {
          name: "Floor Token",
          description: "Main floor access for the live set.",
          benefits: "NFT ticket, verified QR entry, and official marketplace protection.",
          price: 26,
          supply: 34,
        },
        {
          name: "Backstage Ledger",
          description: "Limited backstage access with collector metadata.",
          benefits: "Backstage wristband, priority gate, artist drop eligibility, and resale cap protection.",
          price: 90,
          supply: 6,
        },
      ],
    },
    {
      name: "London Skyline Sessions",
      date: atTime(nextWeekday(now, 5), 21, 30),
      venue_name: "Printworks",
      city: "London",
      capacity: 420,
      description: "A curated rooftop concert blending fashion, music, and clean digital ownership.",
      categories: [
        {
          name: "Skyline Entry",
          description: "Standard access with NFT ticket ownership.",
          benefits: "Fast QR scan, on-chain ticket identity, and secure transfer history.",
          price: 22,
          supply: 28,
        },
        {
          name: "Balcony Member",
          description: "Elevated viewing and limited member collectible.",
          benefits: "Balcony access, private check-in lane, and loyalty reward drop.",
          price: 68,
          supply: 8,
        },
      ],
    },
    {
      name: "Amsterdam Weekender",
      date: weekend,
      venue_name: "Shelter",
      city: "Amsterdam",
      capacity: 2500,
      description: "A weekend festival afterparty with collectible tickets, VIP access, and secure member resale.",
      categories: [
        {
          name: "Festival Pass",
          description: "Afterdark festival entry.",
          benefits: "Mobile QR, NFT ownership, and festival wallet history.",
          price: 34,
          supply: 60,
        },
        {
          name: "VIP Membership",
          description: "VIP lounge and loyalty-linked access.",
          benefits: "VIP lane, private platform, loyalty reward, and limited gold ticket art.",
          price: 120,
          supply: 10,
        },
      ],
    },
    {
      name: "MISO Access Forum",
      date: nextMonthDate(now, 8, 18, 30),
      venue_name: "MISO Members House",
      city: "Lisbon",
      capacity: 300,
      description: "A private culture and technology evening for promoters, artists, collectors, and nightlife members.",
      categories: [
        {
          name: "Member Access",
          description: "Forum entry with digital identity activation.",
          benefits: "Talks, wallet setup, NFT ticket, and loyalty program preview.",
          price: 12,
          supply: 40,
        },
        {
          name: "Founders NFT",
          description: "Limited membership pass for early MISO supporters.",
          benefits: "Priority seating, founders collectible, VIP marketplace access, and future reward eligibility.",
          price: 48,
          supply: 14,
        },
      ],
    },
  ];
}

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

async function hideThrowawayTestEvents() {
  const fixturePrefixes = ["Authz Fixture", "ChainOps Fixture", "Invariant Cancel"];
  for (const prefix of fixturePrefixes) {
    const { error } = await sb
      .from("events")
      .update({ status: "canceled", sales_enabled: false, resale_enabled: false })
      .like("name", `${prefix}%`);
    if (error) throw new Error(`Failed to hide ${prefix} events: ${error.message}`);
  }
  const legacyDemoNames = [
    "Miso Demo Night",
    "Casa Rooftop Sessions",
    "Casa Rooftop Signal",
    "Friday Boiler Set",
    "Atlantic Festival Afterdark",
    "Friday Medina Live",
    "Weekend Beach Afterparty",
    "Miso Launch Forum",
    "After Hours Reset",
    "Morning Pilates Club",
    "Friday Breathwork Salon",
    "Weekend Sauna Circuit",
    "The Urban Calm Forum",
  ];
  const { error } = await sb
    .from("events")
    .update({ status: "canceled", sales_enabled: false, resale_enabled: false })
    .in("name", legacyDemoNames);
  if (error) throw new Error(`Failed to hide legacy demo events: ${error.message}`);
}

async function ensureEvent(event: SeedEvent, organizerUserId: string): Promise<string> {
  const { data: existing } = await sb
    .from("events")
    .select("id")
    .eq("name", event.name)
    .maybeSingle();
  if (existing) {
    await sb
      .from("events")
      .update({
        date: event.date.toISOString(),
        venue_name: event.venue_name,
        city: event.city,
        capacity: event.capacity,
        description: event.description,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: true,
        organizer_user_id: organizerUserId,
        status: "published",
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await sb
    .from("events")
    .insert({
      name: event.name,
      date: event.date.toISOString(),
      venue_name: event.venue_name,
      city: event.city,
      capacity: event.capacity,
      description: event.description,
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: true,
      organizer_user_id: organizerUserId,
      status: "published",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create event: ${error?.message}`);
  return data.id;
}

async function ensureCategoryWithTickets(args: {
  eventId: string;
  name: string;
  description: string;
  benefits: string;
  price: number;
  supply: number;
  currency: "EUR";
}) {
  const { data: existing } = await sb
    .from("ticket_categories")
    .select("id, supply, sold_count")
    .eq("event_id", args.eventId)
    .eq("name", args.name)
    .maybeSingle<{ id: string; supply: number; sold_count: number }>();
  if (existing) {
    const remaining = Math.max(0, existing.supply - existing.sold_count);
    const ticketsToAdd = Math.max(0, args.supply - remaining);
    await sb
      .from("ticket_categories")
      .update({
        price: args.price,
        currency: args.currency,
        description: args.description,
        benefits: args.benefits,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: true,
        supply: existing.supply + ticketsToAdd,
      })
      .eq("id", existing.id);
    if (ticketsToAdd > 0) {
      await insertAvailableTickets({
        eventId: args.eventId,
        categoryId: existing.id,
        count: ticketsToAdd,
      });
    }
    return existing.id;
  }

  const { data: category, error } = await sb
    .from("ticket_categories")
    .insert({
      event_id: args.eventId,
      name: args.name,
      description: args.description,
      benefits: args.benefits,
      price: args.price,
      currency: args.currency,
      supply: args.supply,
      sales_enabled: true,
      resale_enabled: true,
      public_sales_counter_enabled: true,
    })
    .select("id")
    .single();
  if (error || !category) throw new Error(`Failed to create category ${args.name}: ${error?.message}`);

  await insertAvailableTickets({
    eventId: args.eventId,
    categoryId: category.id,
    count: args.supply,
  });

  return category.id;
}

async function insertAvailableTickets(args: {
  eventId: string;
  categoryId: string;
  count: number;
}) {
  if (args.count <= 0) return;

  const { data: lastTicket } = await sb
    .from("tickets")
    .select("serial_number")
    .eq("event_id", args.eventId)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ serial_number: number }>();
  const offset = lastTicket?.serial_number ?? 0;

  const ticketRows = Array.from({ length: args.count }, (_, index) => ({
    event_id: args.eventId,
    category_id: args.categoryId,
    serial_number: offset + index + 1,
    status: "available" as const,
  }));
  const { error: ticketsErr } = await sb.from("tickets").insert(ticketRows);
  if (ticketsErr) throw new Error(`Failed to seed tickets: ${ticketsErr.message}`);
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

  await hideThrowawayTestEvents();
  console.log("  throwaway test events hidden");

  const events = buildSeedEvents();
  for (const [index, event] of events.entries()) {
    const organizerUserId =
      index === 0 ? userIds["organizer@miso.local"] : userIds["admin@miso.local"];
    const eventId = await ensureEvent(event, organizerUserId);
    console.log(`  event ${eventId} — ${event.name} (${event.date.toLocaleString()})`);
    for (const category of event.categories) {
      await ensureCategoryWithTickets({
        eventId,
        name: category.name,
        description: category.description,
        benefits: category.benefits,
        price: category.price,
        supply: category.supply,
        currency: "EUR",
      });
    }
    await ensureController(eventId, userIds["controller@miso.local"]);
  }
  console.log("  events, categories, tickets, and controllers seeded");

  console.log("\nDone. Demo credentials:");
  for (const user of demoUsers) {
    console.log(`  ${user.demoLabel.padEnd(11)}  ${user.email}  /  ${user.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
