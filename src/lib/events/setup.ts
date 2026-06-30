import { lookup as dnsLookup } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import type { Address } from "viem";

import { audit } from "@/lib/audit";
import { casablancaInputToIso } from "@/lib/format";
import { assertEventPublishable } from "@/lib/organizers/permissions";
import { sendEventPublishedEmail } from "@/lib/email/send";
import { createServiceClient } from "@/lib/supabase/service";
import {
  cancelUnsoldTickets,
  markSoldTicketsRefundPending,
} from "@/lib/tickets/lifecycle";
import {
  MISO_TICKET_ABI,
  MISO_TICKET_BYTECODE,
} from "@/lib/thirdweb/contracts/misoTicket";
import { uploadFile } from "@/lib/thirdweb/storage";
import {
  backendWallet,
  deployContract,
  TransactionRevertError,
  TransactionTimeoutError,
  waitForTransaction,
} from "@/lib/thirdweb/transactions";
import type {
  Currency,
  Database,
  EventRow,
  Ticket,
  TicketCategoryKind,
} from "@/types/db";

export interface EventDetailsInput {
  name: string;
  date: string;
  venue_name: string;
  city: string;
  capacity: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
  hero_url?: string | null;
  ticket_visual_url?: string | null;
  marketplace_url?: string | null;
  description?: string | null;
  conditions?: string | null;
  floor_plan_url?: string | null;
  genre?: Database["public"]["Enums"]["event_genre"] | null;
  vibe?: Database["public"]["Enums"]["event_vibe"] | null;
  is_festival: boolean;
  artists: string[];
  organizer_resale_royalty_bps: number;
}

export interface CategoryInput {
  event_id: string;
  kind: TicketCategoryKind;
  name: string;
  description?: string | null;
  price: number;
  currency: Currency;
  supply: number;
  max_resale_price?: number | null;
  sales_enabled: boolean;
  resale_enabled: boolean;
  public_sales_counter_enabled: boolean;
  benefits?: string | null;
  image_url?: string | null;
  sale_starts_at?: Date | null;
  sale_ends_at?: Date | null;
  // Club Table fields (required when kind === 'club_table').
  // Note: `min_spending` is no longer collected — the table `price`
  // doubles as the minimum spending floor at the venue.
  online_advance?: number | null;
  base_capacity?: number | null;
  extra_guests_enabled?: boolean;
  price_per_extra_guest?: number | null;
  max_extra_guests?: number | null;
  color_hex?: string | null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  );
}

export async function createDraftEvent(params: {
  input: EventDetailsInput;
  actorUserId: string;
  organizerUserId: string;
  organizationId: string;
}): Promise<EventRow> {
  const sb = createServiceClient();
  const eventPayload = {
    ...params.input,
    date: casablancaInputToIso(params.input.date),
    organization_id: params.organizationId,
    organizer_user_id: params.organizerUserId,
    slug: `${slugify(params.input.name)}-${randomUUID().slice(0, 8)}`,
    status: "draft" as const,
  };

  const { data: event, error } = await sb
    .from("events")
    .insert(eventPayload)
    .select("*")
    .single<EventRow>();
  if (error || !event) throw error ?? new Error("Event could not be created.");

  await audit({
    actorUserId: params.actorUserId,
    action: "event.create",
    entityType: "event",
    entityId: event.id,
    metadata: { name: event.name },
  });

  return event;
}

export async function updateEventDetails(params: {
  eventId: string;
  input: EventDetailsInput;
  actorUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ ...params.input, date: casablancaInputToIso(params.input.date) })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.actorUserId,
    action: "event.update",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function cancelEventSetup(params: {
  eventId: string;
  actorUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single<EventRow>();
  if (!event) throw new Error("Event not found.");

  const { error } = await sb
    .from("events")
    .update({ status: "canceled" })
    .eq("id", params.eventId);
  if (error) throw error;

  await cancelUnsoldTickets({ eventId: params.eventId });
  await markSoldTicketsRefundPending(params.eventId);

  await audit({
    actorUserId: params.actorUserId,
    action: "event.cancel",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function removeEmptyCategory(params: {
  eventId: string;
  categoryId: string;
  actorUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: category } = await sb
    .from("ticket_categories")
    .select("id, sold_count")
    .eq("id", params.categoryId)
    .single<{ id: string; sold_count: number }>();
  if (!category) throw new Error("Category not found.");
  if (category.sold_count > 0) {
    throw new Error("Category has sold tickets and cannot be removed.");
  }

  const { error: ticketsError } = await sb
    .from("tickets")
    .delete()
    .eq("category_id", params.categoryId)
    .in("status", ["available", "reserved"]);
  if (ticketsError) throw ticketsError;

  const { error: categoryError } = await sb
    .from("ticket_categories")
    .delete()
    .eq("id", params.categoryId);
  if (categoryError) throw categoryError;

  await audit({
    actorUserId: params.actorUserId,
    action: "category.remove",
    entityType: "ticket_category",
    entityId: params.categoryId,
    metadata: { event_id: params.eventId },
  });
}

export async function cancelUnsoldInventory(params: {
  eventId: string;
  categoryId?: string | null;
  actorUserId: string;
}): Promise<void> {
  await cancelUnsoldTickets({
    eventId: params.eventId,
    categoryId: params.categoryId,
  });

  await audit({
    actorUserId: params.actorUserId,
    action: "tickets.cancel_unsold",
    entityType: "event",
    entityId: params.eventId,
    metadata: { category_id: params.categoryId || null },
  });
}

// Publish flow:
//   1. Pin image to IPFS if `image_url` set and `image_ipfs_uri` missing.
//   2. Deploy `MisoTicket(name, "MISO", backendWallet)` if
//      `nft_contract_address` missing. Wait until mined.
//   3. Flip status → published.
// Idempotent: re-running after partial failure resumes from the missing step.
export async function publishEventSetup(params: {
  eventId: string;
  actorUserId: string;
  requireOrganizerLive?: boolean;
}): Promise<void> {
  // Self-serve organizer publishes go through the full publishability
  // gate (inventory, MAD rejection, organizer live, payout readiness).
  // The admin workspace keeps its legacy organization-level gating:
  // admin-created events carry organizer_user_id = admin.id, and admins
  // have no organizer_profile/seller account to be "live" with.
  if (params.requireOrganizerLive) {
    await assertEventPublishable({
      eventId: params.eventId,
      requireOrganizerLive: true,
    });
  }

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single<EventRow>();
  if (!event) throw new Error("Event not found.");

  if (event.image_url && !event.image_ipfs_uri) {
    const imageUri = await pinImageToIpfs(event.image_url);
    const { error: imageError } = await sb
      .from("events")
      .update({ image_ipfs_uri: imageUri })
      .eq("id", params.eventId);
    if (imageError) throw imageError;
    event.image_ipfs_uri = imageUri;
    await audit({
      actorUserId: params.actorUserId,
      action: "event.image_pinned",
      entityType: "event",
      entityId: params.eventId,
      metadata: { uri: imageUri },
    });
  }

  if (!event.nft_contract_address) {
    const admin = await backendWallet();
    const { contractAddress, txHash, transactionId } = await deployMisoTicket({
      name: event.name,
      admin,
    });
    // role_admin_address pins the wallet that holds admin roles on the
    // deployed contract. Future mints/transfers/setAttribute use this
    // as `from`. For events deployed before this column existed it is
    // NULL and chain writes fall back to backendWallet().
    const { error: deployError } = await sb
      .from("events")
      .update({
        nft_contract_address: contractAddress,
        role_admin_address: admin,
      })
      .eq("id", params.eventId);
    if (deployError) throw deployError;
    event.nft_contract_address = contractAddress;
    event.role_admin_address = admin;
    await audit({
      actorUserId: params.actorUserId,
      action: "event.contract_deployed",
      entityType: "event",
      entityId: params.eventId,
      metadata: {
        contract: contractAddress,
        role_admin: admin,
        tx_hash: txHash,
        transaction_id: transactionId,
      },
    });
  }

  const { error } = await sb
    .from("events")
    .update({ status: "published" })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.actorUserId,
    action: "event.publish",
    entityType: "event",
    entityId: params.eventId,
  });

  // Best-effort organizer notification. sendEventPublishedEmail never throws
  // and is a no-op without email env, so it cannot affect the publish result.
  if (event.organizer_user_id) {
    await sendEventPublishedEmail({
      organizerUserId: event.organizer_user_id,
      eventName: event.name,
      storefrontPath: `/events/${event.slug ?? params.eventId}`,
    });
  }
}

export async function unpublishEventSetup(params: {
  eventId: string;
  actorUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ status: "draft" })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.actorUserId,
    action: "event.unpublish",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function createTicketCategory(params: {
  input: CategoryInput;
  actorUserId: string;
}): Promise<{ id: string; event_id: string; supply: number }> {
  const sb = createServiceClient();
  // Pin a category-specific image to IPFS up front so the metadata
  // baked into each NFT mint references the tier's artwork, not the
  // event banner. Done at create time so all mints from this category
  // see a stable URI without a publish-time backfill.
  let imageIpfsUri: string | null = null;
  if (params.input.image_url) {
    imageIpfsUri = await pinImageToIpfs(params.input.image_url);
  }
  const insertPayload = {
    ...params.input,
    max_resale_price: params.input.max_resale_price ?? null,
    image_url: params.input.image_url ?? null,
    sale_starts_at: params.input.sale_starts_at?.toISOString() ?? null,
    sale_ends_at: params.input.sale_ends_at?.toISOString() ?? null,
    image_ipfs_uri: imageIpfsUri,
    // DB constraint requires min_spending NOT NULL for club_table rows.
    // App contract: table `price` doubles as the minimum spending floor.
    min_spending:
      params.input.kind === "club_table" ? params.input.price : null,
  };
  const { data: category, error: categoryError } = await sb
    .from("ticket_categories")
    .insert(insertPayload)
    .select("*")
    .single<{ id: string; event_id: string; supply: number }>();
  if (categoryError || !category) {
    throw categoryError ?? new Error("Category could not be created.");
  }

  const { data: lastTicket } = await sb
    .from("tickets")
    .select("serial_number")
    .eq("event_id", params.input.event_id)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Ticket, "serial_number">>();

  const offset = lastTicket?.serial_number ?? 0;
  const ticketRows = Array.from(
    { length: params.input.supply },
    (_, index) => ({
      event_id: params.input.event_id,
      category_id: category.id,
      serial_number: offset + index + 1,
      status: "available" as const,
    }),
  );

  const { error: ticketsError } = await sb.from("tickets").insert(ticketRows);
  if (ticketsError) {
    await sb.from("ticket_categories").delete().eq("id", category.id);
    throw ticketsError;
  }

  await audit({
    actorUserId: params.actorUserId,
    action: "category.create",
    entityType: "ticket_category",
    entityId: category.id,
    metadata: { event_id: params.input.event_id, supply: params.input.supply },
  });

  return category;
}

// Hard limits for admin-supplied event image URLs. Even though this
// runs admin-only, the fetch happens server-side so we still need to
// block SSRF vectors: private/link-local hosts, non-HTTP(S) schemes,
// oversized payloads, and non-image content types.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|avif)$/i;

function isPrivateIPv4(addr: string): boolean {
  const v4 = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, "");
  if (a === "::1" || a === "::") return true;
  if (a.startsWith("fe80:") || a.startsWith("fe80::")) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(a)) return true; // fc00::/7 unique-local
  // IPv4-mapped IPv6: ::ffff:a.b.c.d (decoded form) or ::ffff:xxxx:yyyy (hex form)
  const mappedDecoded = a.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
  );
  if (mappedDecoded) return isPrivateIPv4(mappedDecoded[1]!);
  const mappedHex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1]!, 16);
    const lo = parseInt(mappedHex[2]!, 16);
    const ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIPv4(ip);
  }
  return false;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (isPrivateIPv4(h)) return true;
  if (h.includes(":") && isPrivateIPv6(h)) return true;
  return false;
}

// Resolve hostname to A/AAAA and reject if any answer is in a private/loopback
// range. Defeats DNS-rebinding tricks like `*.nip.io` resolving to 169.254.169.254
// (AWS IMDS) or attacker-controlled domains pointing at internal addresses.
async function assertResolvedHostIsPublic(hostname: string): Promise<void> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  // Already a literal IP — covered by syntactic check; dns.lookup would echo it back.
  if (isPrivateIPv4(bare) || (bare.includes(":") && isPrivateIPv6(bare))) {
    throw new Error("Event image URL host is not allowed");
  }
  let resolved: { address: string; family: number }[];
  try {
    resolved = await dnsLookup(bare, { all: true, verbatim: true });
  } catch {
    throw new Error(`Failed to resolve event image host: ${hostname}`);
  }
  for (const { address, family } of resolved) {
    const bad = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (bad) {
      throw new Error("Event image URL resolves to a private host");
    }
  }
}

export type ImageHostClass = "local-supabase" | "blocked" | "public-candidate";

export function classifyImageHost(
  url: URL,
  opts: { supabaseUrl: string | undefined; nodeEnv: string | undefined },
): ImageHostClass {
  let supabaseHost = "";
  if (opts.supabaseUrl) {
    try {
      supabaseHost = new URL(opts.supabaseUrl).hostname;
    } catch {
      supabaseHost = "";
    }
  }
  const isLocalSupabase =
    opts.nodeEnv !== "production" &&
    !!supabaseHost &&
    url.hostname === supabaseHost;
  if (isLocalSupabase) return "local-supabase";
  if (isPrivateOrLocalHost(url.hostname)) return "blocked";
  return "public-candidate";
}

async function pinImageToIpfs(imageUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Event image URL is malformed");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Event image URL must be http(s)");
  }
  const hostClass = classifyImageHost(url, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
  const isLocalSupabase = hostClass === "local-supabase";
  if (!isLocalSupabase) {
    if (hostClass === "blocked") {
      throw new Error("Event image URL host is not allowed");
    }
    await assertResolvedHostIsPublic(url.hostname);
  }

  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch event image (${imageUrl}): HTTP ${res.status}`,
    );
  }
  // If `fetch` followed redirects, recheck the final host both syntactically
  // and via DNS — a public hostname can redirect to one that resolves private.
  const finalUrl = new URL(res.url);
  if (!isLocalSupabase) {
    if (isPrivateOrLocalHost(finalUrl.hostname)) {
      throw new Error("Event image URL redirected to a private host");
    }
    if (finalUrl.hostname !== url.hostname) {
      await assertResolvedHostIsPublic(finalUrl.hostname);
    }
  }
  const mimeType =
    res.headers.get("content-type") ?? "application/octet-stream";
  if (!ALLOWED_IMAGE_MIME.test(mimeType.split(";")[0]!.trim())) {
    throw new Error(`Event image MIME type not allowed: ${mimeType}`);
  }
  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("Event image exceeds 5 MB cap");
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Event image exceeds 5 MB cap");
  }
  const blob = new Blob([buffer], { type: mimeType });
  return uploadFile({ data: blob, mimeType });
}

async function deployMisoTicket(args: {
  name: string;
  admin: Address;
}): Promise<{
  contractAddress: Address;
  txHash: string;
  transactionId: string;
}> {
  const deployed = await deployContract({
    bytecode: MISO_TICKET_BYTECODE,
    abi: MISO_TICKET_ABI as unknown as import("viem").Abi,
    constructorParams: {
      name_: args.name,
      symbol_: "MISO",
      admin: args.admin,
    },
  });
  try {
    const record = await waitForTransaction(deployed.transactionId, {
      timeoutMs: 180_000,
    });
    return {
      contractAddress: deployed.address,
      txHash: record.transactionHash ?? "",
      transactionId: deployed.transactionId,
    };
  } catch (err) {
    if (err instanceof TransactionRevertError) {
      throw new Error(
        `MisoTicket deploy reverted: ${err.record.errorMessage ?? "unknown"}`,
      );
    }
    if (err instanceof TransactionTimeoutError) {
      throw new Error(
        `MisoTicket deploy timed out (transactionId=${err.transactionId}); rerun publish to resume.`,
      );
    }
    throw err;
  }
}
