"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireOrganizerWorkspace } from "@/lib/auth";
import {
  cancelEventSetup,
  cancelUnsoldInventory,
  createDraftEvent,
  createTicketCategory,
  publishEventSetup,
  removeEmptyCategory,
  unpublishEventSetup,
  updateEventDetails,
} from "@/lib/events/setup";
import {
  canManageEvent,
} from "@/lib/organizations/auth";
import {
  getActiveAdminOrganization,
  setActiveAdminOrganization,
} from "@/lib/organizations/context";
import {
  ensureOrganizationControllerMembership,
  findOrInvitePlatformAccount,
  removeOrganizationMembership,
  upsertOrganizationMembership,
} from "@/lib/organizations/members";
import {
  deleteEmptyOrganization,
  transferOrganizationOwnership,
} from "@/lib/organizations/ownership";
import { createOrganizationForAdmin } from "@/lib/organizations/setup";
import { refundTicket } from "@/lib/refunds/refund";
import { manuallyRefundPayment } from "@/lib/stripe-marketplace/refunds";
import type { MarketplacePaymentRow } from "@/lib/stripe-marketplace/payments";
import {
  CreateCategorySchema,
  CreateEventSchema,
  CreateOrganizationSchema,
  DeleteOrganizationSchema,
  InviteControllerSchema,
  OrganizationMemberSchema,
  OrganizationBrandingSchema,
  OrganizationRoyaltySchema,
  RefundSchema,
  RemoveOrganizationMemberSchema,
  SiteSettingsSchema,
  SwitchOrganizationSchema,
  TransferOrganizationSchema,
} from "@/lib/schemas";
import {
  normalizeOrganizationBranding,
  organizationBrandingJson,
} from "@/lib/organizations/branding";
import { updateSiteSettings as saveSiteSettings } from "@/lib/site/settings";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Profile, Ticket, TicketCategory } from "@/types/db";

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function artistsFromForm(formData: FormData): string[] {
  const raw = String(formData.get("artists") ?? "");
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/)
        .map((artist) => artist.trim())
        .filter(Boolean),
    ),
  );
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventFormPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    date: formData.get("date"),
    venue_name: formData.get("venue_name"),
    city: formData.get("city"),
    capacity: formData.get("capacity"),
    image_url: optionalString(formData, "image_url"),
    thumbnail_url: optionalString(formData, "thumbnail_url"),
    hero_url: optionalString(formData, "hero_url"),
    ticket_visual_url: optionalString(formData, "ticket_visual_url"),
    marketplace_url: optionalString(formData, "marketplace_url"),
    description: optionalString(formData, "description"),
    conditions: optionalString(formData, "conditions"),
    floor_plan_url: optionalString(formData, "floor_plan_url"),
    genre: optionalString(formData, "genre"),
    vibe: optionalString(formData, "vibe"),
    is_festival: checkbox(formData, "is_festival"),
    artists: artistsFromForm(formData),
  };
}

async function assertCanManageEvent(
  profile: Pick<Profile, "id" | "role">,
  eventId: string,
  path: string,
): Promise<EventRow> {
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) fail(path, "Event not found.");
  if (!(await canManageEvent(profile, event))) {
    fail("/admin/events", "You can only manage events for your organization.");
  }
  return event;
}

export async function createEvent(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  const organizationId = activeOrganization?.id ?? null;
  if (!organizationId) {
    fail("/admin/events/new", "Select an organization before creating an event.");
  }
  const parsed = CreateEventSchema.safeParse(eventFormPayload(formData));

  if (!parsed.success) fail("/admin/events/new", parsed.error.issues[0]?.message ?? "Invalid event.");

  let event: { id: string };
  try {
    event = await createDraftEvent({
      input: parsed.data,
      actorUserId: admin.id,
      organizerUserId: admin.id,
      organizationId,
    });
  } catch (error) {
    fail("/admin/events/new", errorMessage(error, "Event could not be created."));
  }
  redirect(`/admin/events/${event.id}`);
}

export async function createOrganization(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const parsed = CreateOrganizationSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    fail("/admin/organizations/new", parsed.error.issues[0]?.message ?? "Invalid organization.");
  }

  let organization: { id: string; name: string };
  try {
    organization = await createOrganizationForAdmin({
      name: parsed.data.name,
      adminUserId: admin.id,
    });
  } catch (error) {
    fail("/admin/organizations/new", errorMessage(error, "Organization could not be created."));
  }

  await setActiveAdminOrganization(admin.id, organization.id);
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  redirect(`/admin?success=${encodeURIComponent(`${organization.name} selected.`)}`);
}

export async function switchOrganization(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const parsed = SwitchOrganizationSchema.safeParse({
    organization_id: formData.get("organization_id"),
  });
  if (!parsed.success) fail("/admin", "Invalid organization.");

  const switched = await setActiveAdminOrganization(admin.id, parsed.data.organization_id);
  if (!switched) fail("/admin", "You can only switch to organizations you administer.");

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  redirect("/admin");
}

export async function updateOrganizationBranding(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = OrganizationBrandingSchema.safeParse({
    tagline: optionalString(formData, "tagline"),
    accent_color: optionalString(formData, "accent_color"),
    logo_url: optionalString(formData, "logo_url"),
    hero_image_url: optionalString(formData, "hero_image_url"),
  });
  if (!parsed.success) {
    fail("/admin/settings", parsed.error.issues[0]?.message ?? "Invalid branding.");
  }

  const branding = normalizeOrganizationBranding(parsed.data);
  const sb = createServiceClient();
  const { error } = await sb
    .from("organizations")
    .update({ branding: organizationBrandingJson(branding) })
    .eq("id", activeOrganization.id);
  if (error) fail("/admin/settings", error.message);

  await audit({
    actorUserId: admin.id,
    action: "organization.branding.update",
    entityType: "organization",
    entityId: activeOrganization.id,
    metadata: { organization_slug: activeOrganization.slug },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath(`/s/${activeOrganization.slug}`);
  revalidatePath(`/s/${activeOrganization.slug}/marketplace`);
  redirect("/admin/settings?success=Branding%20saved.");
}

export async function updateOrganizationRoyalty(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = OrganizationRoyaltySchema.safeParse({
    resale_royalty_enabled: checkbox(formData, "resale_royalty_enabled"),
    resale_royalty_bps: formData.get("resale_royalty_bps") || 0,
  });
  if (!parsed.success) {
    fail("/admin/settings", parsed.error.issues[0]?.message ?? "Invalid royalty settings.");
  }

  const bps = parsed.data.resale_royalty_enabled ? parsed.data.resale_royalty_bps : 0;
  const sb = createServiceClient();
  const { error } = await sb
    .from("organizations")
    .update({
      resale_royalty_enabled: parsed.data.resale_royalty_enabled,
      resale_royalty_bps: bps,
    })
    .eq("id", activeOrganization.id);
  if (error) fail("/admin/settings", error.message);

  await audit({
    actorUserId: admin.id,
    action: "organization.royalty.update",
    entityType: "organization",
    entityId: activeOrganization.id,
    metadata: {
      resale_royalty_enabled: parsed.data.resale_royalty_enabled,
      resale_royalty_bps: bps,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath(`/s/${activeOrganization.slug}/marketplace`);
  redirect("/admin/settings?success=Royalty%20settings%20saved.");
}

export async function addOrganizationMember(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = OrganizationMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    fail("/admin/settings", parsed.error.issues[0]?.message ?? "Invalid team member.");
  }

  const { email, role } = parsed.data;
  let userId: string;
  try {
    userId = await findOrInvitePlatformAccount(email);
  } catch (error) {
    fail("/admin/settings", errorMessage(error, "Invite could not be sent."));
  }

  try {
    await upsertOrganizationMembership({
      organizationId: activeOrganization.id,
      userId,
      role,
    });
  } catch (error) {
    fail("/admin/settings", errorMessage(error, "Team member could not be saved."));
  }

  await audit({
    actorUserId: admin.id,
    action: "organization.member.upsert",
    entityType: "organization",
    entityId: activeOrganization.id,
    metadata: { email, user_id: userId, role },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=Team%20member%20saved.");
}

export async function transferOrganization(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = TransferOrganizationSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    fail("/admin/settings", parsed.error.issues[0]?.message ?? "Invalid transfer recipient.");
  }

  try {
    await transferOrganizationOwnership({
      actorUserId: admin.id,
      organization: activeOrganization,
      recipientEmail: parsed.data.email,
    });
  } catch (error) {
    fail("/admin/settings", errorMessage(error, "Organization transfer could not be saved."));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=Organization%20transfer%20saved.");
}

export async function deleteOrganization(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = DeleteOrganizationSchema.safeParse({
    organization_id: formData.get("organization_id"),
    confirm_name: formData.get("confirm_name"),
  });
  if (!parsed.success) fail("/admin/settings", "Invalid delete request.");

  try {
    await deleteEmptyOrganization({
      actorUserId: admin.id,
      organization: activeOrganization,
      confirmedOrganizationId: parsed.data.organization_id,
      confirmedName: parsed.data.confirm_name,
    });
  } catch (error) {
    fail("/admin/settings", errorMessage(error, "Organization could not be deleted."));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/admin/settings");
  redirect("/admin?success=Organization%20deleted.");
}

export async function removeOrganizationMember(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const { activeOrganization } = await getActiveAdminOrganization(admin);
  if (!activeOrganization) fail("/admin/settings", "Select an organization first.");

  const parsed = RemoveOrganizationMemberSchema.safeParse({
    membership_id: formData.get("membership_id"),
  });
  if (!parsed.success) fail("/admin/settings", "Invalid team member.");

  let removed;
  try {
    removed = await removeOrganizationMembership({
      organizationId: activeOrganization.id,
      membershipId: parsed.data.membership_id,
    });
  } catch (error) {
    fail("/admin/settings", errorMessage(error, "Team member could not be removed."));
  }

  await audit({
    actorUserId: admin.id,
    action: "organization.member.remove",
    entityType: "organization",
    entityId: activeOrganization.id,
    metadata: { user_id: removed.userId, role: removed.role },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=Team%20member%20removed.");
}

export async function updateEvent(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);

  const parsed = CreateEventSchema.safeParse(eventFormPayload(formData));
  if (!parsed.success) fail(`/admin/events/${eventId}`, parsed.error.issues[0]?.message ?? "Invalid event.");

  try {
    await updateEventDetails({
      eventId,
      input: parsed.data,
      actorUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be updated."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function updateSiteSettings(formData: FormData) {
  await requireOrganizerWorkspace();
  const parsed = SiteSettingsSchema.safeParse({
    landing_hero_bg_url: optionalString(formData, "landing_hero_bg_url"),
    landing_audience_url: optionalString(formData, "landing_audience_url"),
    landing_dashboard_url: optionalString(formData, "landing_dashboard_url"),
  });
  if (!parsed.success) {
    fail("/admin/site", parsed.error.issues[0]?.message ?? "Invalid landing media.");
  }

  try {
    await saveSiteSettings(parsed.data);
  } catch (error) {
    fail("/admin/site", errorMessage(error, "Landing media could not be saved."));
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin/site?success=Landing%20media%20saved.");
}

export async function cancelEvent(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);

  try {
    await cancelEventSetup({ eventId, actorUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be canceled."));
  }
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function removeCategory(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const categoryId = String(formData.get("category_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  if (!categoryId || !eventId) fail(`/admin/events/${eventId}`, "Missing category or event id.");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);

  try {
    await removeEmptyCategory({ eventId, categoryId, actorUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Category could not be removed."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function cancelUnsoldTickets(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!eventId) fail("/admin", "Missing event id.");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);

  try {
    await cancelUnsoldInventory({
      eventId,
      categoryId: categoryId || null,
      actorUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Tickets could not be canceled."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function publishEvent(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);
  try {
    await publishEventSetup({ eventId, actorUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be published."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
}

export async function unpublishEvent(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);
  try {
    await unpublishEventSetup({ eventId, actorUserId: admin.id });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Event could not be unpublished."));
  }
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/events");
}

export async function createCategory(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const parsed = CreateCategorySchema.safeParse({
    event_id: formData.get("event_id"),
    kind: (formData.get("kind") as string) || "standard",
    name: formData.get("name"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    currency: formData.get("currency"),
    supply: formData.get("supply"),
    max_resale_price: formData.get("max_resale_price") || null,
    sales_enabled: checkbox(formData, "sales_enabled"),
    resale_enabled: checkbox(formData, "resale_enabled"),
    public_sales_counter_enabled: checkbox(formData, "public_sales_counter_enabled"),
    benefits: formData.get("benefits") || null,
    image_url: formData.get("image_url") || null,
    online_advance: formData.get("online_advance") || null,
    base_capacity: formData.get("base_capacity") || null,
    extra_guests_enabled: checkbox(formData, "extra_guests_enabled"),
    price_per_extra_guest: formData.get("price_per_extra_guest") || null,
    max_extra_guests: formData.get("max_extra_guests") || null,
    color_hex: formData.get("color_hex") || null,
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid category.");
  await assertCanManageEvent(admin, parsed.data.event_id, `/admin/events/${parsed.data.event_id}`);

  try {
    await createTicketCategory({
      input: parsed.data,
      actorUserId: admin.id,
    });
  } catch (error) {
    fail(`/admin/events/${parsed.data.event_id}`, errorMessage(error, "Category could not be created."));
  }
  revalidatePath(`/admin/events/${parsed.data.event_id}`);
}

export async function inviteController(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const parsed = InviteControllerSchema.safeParse({
    event_id: formData.get("event_id"),
    email: formData.get("email"),
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid controller invite.");
  await assertCanManageEvent(admin, parsed.data.event_id, `/admin/events/${parsed.data.event_id}`);

  const sb = createServiceClient();
  const email = parsed.data.email.toLowerCase();
  const { data: event } = await sb
    .from("events")
    .select("organization_id")
    .eq("id", parsed.data.event_id)
    .single<{ organization_id: string | null }>();
  if (!event) fail(`/admin/events/${parsed.data.event_id}`, "Event not found.");

  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle<{ id: string; role: string }>();

  let userId = existingProfile?.id;
  if (!userId) {
    try {
      userId = await findOrInvitePlatformAccount(email);
    } catch (error) {
      fail(`/admin/events/${parsed.data.event_id}`, errorMessage(error, "Invite could not be sent."));
    }
  } else if (!event.organization_id && existingProfile?.role !== "admin" && existingProfile?.role !== "organizer") {
    await sb.from("profiles").update({ role: "controller" }).eq("id", userId);
  }

  if (event.organization_id) {
    try {
      await ensureOrganizationControllerMembership({
        organizationId: event.organization_id,
        userId,
      });
    } catch (error) {
      fail(`/admin/events/${parsed.data.event_id}`, errorMessage(error, "Controller could not be added to Organization."));
    }
  }

  const { error } = await sb.from("event_controllers").upsert({
    event_id: parsed.data.event_id,
    user_id: userId,
  });
  if (error) fail(`/admin/events/${parsed.data.event_id}`, error.message);

  await audit({
    actorUserId: admin.id,
    action: "controller.invite",
    entityType: "event",
    entityId: parsed.data.event_id,
    metadata: { email, user_id: userId },
  });
  revalidatePath(`/admin/events/${parsed.data.event_id}`);
}

export async function refundTicketAction(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const parsed = RefundSchema.safeParse({
    ticket_id: formData.get("ticket_id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) fail("/admin", parsed.error.issues[0]?.message ?? "Invalid refund request.");

  const sb = createServiceClient();
  const { data: ticket } = await sb
    .from("tickets")
    .select("*")
    .eq("id", parsed.data.ticket_id)
    .maybeSingle<Ticket>();
  if (!ticket) fail("/admin", "Ticket not found.");
  await assertCanManageEvent(admin, ticket.event_id, `/admin/events/${ticket.event_id}`);

  await refundTicket({
    ticketId: parsed.data.ticket_id,
    adminUserId: admin.id,
    reason: parsed.data.reason,
  });
  revalidatePath("/admin");
}

export async function duplicateEventAction(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) fail("/admin/events", "Missing event id.");

  const source = await assertCanManageEvent(admin, eventId, `/admin/events/${eventId}`);

  const sb = createServiceClient();

  const { data: newEvent, error: insertError } = await sb
    .from("events")
    .insert({
      name: `${source.name} (copy)`,
      date: source.date,
      venue_name: source.venue_name,
      city: source.city,
      capacity: source.capacity,
      description: source.description,
      conditions: source.conditions,
      floor_plan_url: source.floor_plan_url,
      image_url: source.image_url,
      thumbnail_url: source.thumbnail_url,
      hero_url: source.hero_url,
      ticket_visual_url: source.ticket_visual_url,
      marketplace_url: source.marketplace_url,
      genre: source.genre,
      vibe: source.vibe,
      is_festival: source.is_festival,
      artists: source.artists,
      organization_id: source.organization_id,
      organizer_user_id: source.organizer_user_id,
      status: "draft",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !newEvent) {
    fail(`/admin/events/${eventId}`, insertError?.message ?? "Event could not be duplicated.");
  }

  const { data: sourceCategories } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("event_id", eventId)
    .returns<TicketCategory[]>();

  if (sourceCategories?.length) {
    const categoryRows = sourceCategories.map((cat) => ({
      event_id: newEvent.id,
      name: cat.name,
      description: cat.description,
      kind: cat.kind,
      price: cat.price,
      currency: cat.currency,
      supply: cat.supply,
      sales_enabled: cat.sales_enabled,
      resale_enabled: cat.resale_enabled,
      public_sales_counter_enabled: cat.public_sales_counter_enabled,
      max_resale_price: cat.max_resale_price,
      benefits: cat.benefits,
      image_url: cat.image_url,
      online_advance: cat.online_advance,
      base_capacity: cat.base_capacity,
      extra_guests_enabled: cat.extra_guests_enabled,
      price_per_extra_guest: cat.price_per_extra_guest,
      max_extra_guests: cat.max_extra_guests,
      color_hex: cat.color_hex,
      min_spending: cat.min_spending,
    }));
    const { error: catError } = await sb.from("ticket_categories").insert(categoryRows);
    if (catError) {
      await sb.from("events").delete().eq("id", newEvent.id);
      fail(`/admin/events/${eventId}`, catError.message);
    }
  }

  await audit({
    actorUserId: admin.id,
    action: "event.duplicate",
    entityType: "event",
    entityId: newEvent.id,
    metadata: { source_event_id: eventId, name: `${source.name} (copy)` },
  });

  revalidatePath("/admin/events");
  redirect(`/admin/events/${newEvent.id}`);
}

export async function refundMarketplacePaymentAction(formData: FormData) {
  const admin = await requireOrganizerWorkspace();
  const paymentId = String(formData.get("payment_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  if (!paymentId) fail("/admin", "Missing payment id.");
  if (!eventId) fail("/admin", "Missing event id.");

  const sb = createServiceClient();
  const { data: payment } = await sb
    .from("marketplace_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle<MarketplacePaymentRow>();
  if (!payment) fail(`/admin/events/${eventId}`, "Marketplace payment not found.");

  // Authorize against the event the payment actually belongs to, derived
  // server-side — never against the form's event_id, which any organizer
  // could point at an event they manage while refunding someone else's payment.
  let paymentEventId: string | null = null;
  if (payment.kind === "primary") {
    // Multi-item primary payments carry purchase_id = null and link via
    // marketplace_payment_items; legacy rows still carry a single purchase_id.
    let purchaseId = payment.purchase_id;
    if (!purchaseId) {
      const { data: item } = await sb
        .from("marketplace_payment_items")
        .select("purchase_id")
        .eq("marketplace_payment_id", payment.id)
        .limit(1)
        .maybeSingle<{ purchase_id: string }>();
      purchaseId = item?.purchase_id ?? null;
    }
    if (purchaseId) {
      const { data: purchase } = await sb
        .from("purchases")
        .select("event_id")
        .eq("id", purchaseId)
        .maybeSingle<{ event_id: string }>();
      paymentEventId = purchase?.event_id ?? null;
    }
  } else if (payment.resale_listing_id) {
    const { data: listing } = await sb
      .from("resale_listings")
      .select("ticket_id")
      .eq("id", payment.resale_listing_id)
      .maybeSingle<{ ticket_id: string }>();
    if (listing) {
      const { data: ticket } = await sb
        .from("tickets")
        .select("event_id")
        .eq("id", listing.ticket_id)
        .maybeSingle<{ event_id: string }>();
      paymentEventId = ticket?.event_id ?? null;
    }
  }
  if (!paymentEventId || paymentEventId !== eventId) {
    fail(`/admin/events/${eventId}`, "Payment does not belong to this event.");
  }

  await assertCanManageEvent(admin, paymentEventId, `/admin/events/${eventId}`);

  try {
    await manuallyRefundPayment({ payment });
  } catch (error) {
    fail(`/admin/events/${eventId}`, errorMessage(error, "Refund could not be processed."));
  }

  revalidatePath(`/admin/events/${eventId}`);
}
