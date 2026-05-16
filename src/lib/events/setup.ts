import type { Address } from "viem";

import { audit } from "@/lib/audit";
import { casablancaInputToIso } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import { cancelUnsoldTickets, markSoldTicketsRefundPending } from "@/lib/tickets/lifecycle";
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
import type { Currency, EventRow, Ticket } from "@/types/db";

export interface EventDetailsInput {
  name: string;
  date: string;
  venue_name: string;
  city: string;
  capacity: number;
  image_url?: string | null;
  description?: string | null;
  conditions?: string | null;
  sales_enabled: boolean;
  resale_enabled: boolean;
  public_sales_counter_enabled: boolean;
}

export interface CategoryInput {
  event_id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: Currency;
  supply: number;
  max_resale_price?: number | null;
  resale_enabled: boolean;
  benefits?: string | null;
}


export async function createDraftEvent(params: {
  input: EventDetailsInput;
  adminUserId: string;
}): Promise<EventRow> {
  const sb = createServiceClient();
  const eventPayload = {
    ...params.input,
    date: casablancaInputToIso(params.input.date),
    status: "draft" as const,
  };

  const { data: event, error } = await sb
    .from("events")
    .insert(eventPayload)
    .select("*")
    .single<EventRow>();
  if (error || !event) throw error ?? new Error("Event could not be created.");

  await audit({
    actorUserId: params.adminUserId,
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
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ ...params.input, date: casablancaInputToIso(params.input.date) })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: "event.update",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function cancelEventSetup(params: {
  eventId: string;
  adminUserId: string;
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
    actorUserId: params.adminUserId,
    action: "event.cancel",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function removeEmptyCategory(params: {
  eventId: string;
  categoryId: string;
  adminUserId: string;
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
    actorUserId: params.adminUserId,
    action: "category.remove",
    entityType: "ticket_category",
    entityId: params.categoryId,
    metadata: { event_id: params.eventId },
  });
}

export async function cancelUnsoldInventory(params: {
  eventId: string;
  categoryId?: string | null;
  adminUserId: string;
}): Promise<void> {
  await cancelUnsoldTickets({
    eventId: params.eventId,
    categoryId: params.categoryId,
  });

  await audit({
    actorUserId: params.adminUserId,
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
  adminUserId: string;
}): Promise<void> {
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
      actorUserId: params.adminUserId,
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
      actorUserId: params.adminUserId,
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
    actorUserId: params.adminUserId,
    action: "event.publish",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function unpublishEventSetup(params: {
  eventId: string;
  adminUserId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("events")
    .update({ status: "draft" })
    .eq("id", params.eventId);
  if (error) throw error;

  await audit({
    actorUserId: params.adminUserId,
    action: "event.unpublish",
    entityType: "event",
    entityId: params.eventId,
  });
}

export async function createTicketCategory(params: {
  input: CategoryInput;
  adminUserId: string;
}): Promise<{ id: string; event_id: string; supply: number }> {
  const sb = createServiceClient();
  const insertPayload = {
    ...params.input,
    max_resale_price: params.input.max_resale_price ?? null,
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
  const ticketRows = Array.from({ length: params.input.supply }, (_, index) => ({
    event_id: params.input.event_id,
    category_id: category.id,
    serial_number: offset + index + 1,
    status: "available" as const,
  }));

  const { error: ticketsError } = await sb.from("tickets").insert(ticketRows);
  if (ticketsError) {
    await sb.from("ticket_categories").delete().eq("id", category.id);
    throw ticketsError;
  }

  await audit({
    actorUserId: params.adminUserId,
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

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  // IPv6 loopback / link-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  // Numeric IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 127) return true;                        // 127.0.0.0/8
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 0) return true;                          // 0.0.0.0/8
    if (a >= 224) return true;                         // multicast / reserved
  }
  return false;
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
  if (isPrivateOrLocalHost(url.hostname)) {
    throw new Error("Event image URL host is not allowed");
  }

  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch event image (${imageUrl}): HTTP ${res.status}`,
    );
  }
  // If `fetch` followed redirects, recheck the final host. Public DNS
  // can resolve to a private IP via redirect; that would land here.
  const finalUrl = new URL(res.url);
  if (isPrivateOrLocalHost(finalUrl.hostname)) {
    throw new Error("Event image URL redirected to a private host");
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
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
}): Promise<{ contractAddress: Address; txHash: string; transactionId: string }> {
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
