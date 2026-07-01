import { z } from "zod";

const CurrencySchema = z.literal("EUR");
const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #AABBCC");

const CategoryKindSchema = z.enum(["standard", "club_table"]);
const EventGenreSchema = z.enum([
  "techno",
  "afro_house",
  "rap",
  "commercial",
  "live",
]);
const EventVibeSchema = z.enum([
  "club",
  "festival",
  "rooftop",
  "student_party",
  "private_event",
]);

export const CreateEventSchema = z.object({
  name: z.string().min(2).max(120),
  date: z.string().min(8),
  venue_name: z.string().min(2).max(120),
  city: z.string().min(2).max(80),
  capacity: z.coerce.number().int().positive(),
  image_url: z.string().url().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  hero_url: z.string().url().optional().nullable(),
  ticket_visual_url: z.string().url().optional().nullable(),
  marketplace_url: z.string().url().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  conditions: z.string().max(2000).optional().nullable(),
  floor_plan_url: z.string().url().optional().nullable(),
  genre: EventGenreSchema.optional().nullable(),
  vibe: EventVibeSchema.optional().nullable(),
  is_festival: z.boolean().default(false),
  artists: z.array(z.string().min(1).max(80)).max(20).default([]),
  organizer_resale_royalty_bps: z.coerce
    .number()
    .int()
    .min(0)
    .max(5000)
    .default(0),
});

export const SiteSettingsSchema = z.object({
  landing_hero_bg_url: z.string().url().optional().nullable(),
  landing_audience_url: z.string().url().optional().nullable(),
  landing_dashboard_url: z.string().url().optional().nullable(),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const SwitchOrganizationSchema = z.object({
  organization_id: z.string().uuid(),
});

export const OrganizationBrandingSchema = z.object({
  tagline: z.string().trim().max(180).optional().nullable(),
  accent_color: HexColor.optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  hero_image_url: z.string().url().optional().nullable(),
});

export const OrganizationRoyaltySchema = z.object({
  resale_royalty_enabled: z.coerce.boolean().default(false),
  resale_royalty_bps: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const OrganizationMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "controller"]),
});

export const RemoveOrganizationMemberSchema = z.object({
  membership_id: z.string().uuid(),
});

export const TransferOrganizationSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
});

export const DeleteOrganizationSchema = z.object({
  organization_id: z.string().uuid(),
  confirm_name: z.string().trim().min(1),
});

const ClubTableFields = z.object({
  online_advance: z.coerce.number().min(0).optional().nullable(),
  base_capacity: z.coerce.number().int().positive().optional().nullable(),
  extra_guests_enabled: z.coerce.boolean().default(false),
  price_per_extra_guest: z.coerce.number().min(0).optional().nullable(),
  max_extra_guests: z.coerce.number().int().min(0).optional().nullable(),
  color_hex: HexColor.optional().nullable(),
});

export const CreateCategorySchema = z
  .object({
    event_id: z.string().uuid(),
    kind: CategoryKindSchema.default("standard"),
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional().nullable(),
    price: z.coerce.number().min(0),
    currency: CurrencySchema,
    supply: z.coerce.number().int().positive(),
    max_resale_price: z.coerce.number().min(0).optional().nullable(),
    sales_enabled: z.coerce.boolean().default(true),
    resale_enabled: z.coerce.boolean().default(true),
    public_sales_counter_enabled: z.coerce.boolean().default(true),
    benefits: z.string().max(1000).optional().nullable(),
    image_url: z.string().url().optional().nullable(),
    sale_starts_at: z.coerce.date().optional().nullable(),
    sale_ends_at: z.coerce.date().optional().nullable(),
  })
  .merge(ClubTableFields)
  .refine(
    (v) =>
      v.kind === "standard" ||
      (v.online_advance != null &&
        v.base_capacity != null &&
        v.color_hex != null),
    {
      message:
        "Club Table requires online advance, base capacity, and a color.",
    },
  )
  .refine(
    (v) =>
      !(v.sale_starts_at && v.sale_ends_at) ||
      v.sale_ends_at.getTime() > v.sale_starts_at.getTime(),
    { message: "Sales end must be after sales start." },
  )
  .refine(
    (v) =>
      v.kind !== "club_table" ||
      !v.extra_guests_enabled ||
      (v.price_per_extra_guest != null &&
        v.max_extra_guests != null &&
        v.max_extra_guests > 0),
    {
      message:
        "Extra guests require a price per extra guest and a positive max extra guests.",
    },
  );

export const ResellInitSchema = z.object({
  ticket_id: z.string().uuid(),
  price: z.coerce.number().min(0),
});

export const RefundSchema = z.object({
  ticket_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const InviteControllerSchema = z.object({
  event_id: z.string().uuid(),
  email: z.string().email(),
});

export const OpenGateSchema = z.object({
  event_id: z.string().uuid(),
  gate_name: z.string().max(80).optional().nullable(),
  allowed_category_ids: z
    .array(z.string().uuid())
    .max(50)
    .optional()
    .nullable(),
  ttl_hours: z.coerce.number().int().min(1).max(24).optional(),
});

export const RedeemConfirmSchema = z.object({
  gate_short_code: z.string().min(4).max(16).trim().toUpperCase(),
  ticket_id: z.string().uuid(),
  token: z.string().max(64).optional(),
});

export const RedeemPrepareSchema = z.object({
  gate_short_code: z.string().min(4).max(16).trim().toUpperCase(),
  ticket_id: z.string().uuid(),
});

// EVM 0x address. Used for off-platform NFT exports.
const EvmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Address must be a valid 0x EVM address");

export const TransferToWalletSchema = z.object({
  ticket_id: z.string().uuid(),
  destination_address: EvmAddressSchema,
});
