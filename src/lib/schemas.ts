import { z } from "zod";

export const CurrencySchema = z.literal("MAD");

export const CreateEventSchema = z.object({
  name: z.string().min(2).max(120),
  date: z.string().min(8),
  venue_name: z.string().min(2).max(120),
  city: z.string().min(2).max(80),
  capacity: z.coerce.number().int().positive(),
  image_url: z.string().url().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  conditions: z.string().max(2000).optional().nullable(),
  sales_enabled: z.coerce.boolean().default(false),
  resale_enabled: z.coerce.boolean().default(false),
  public_sales_counter_enabled: z.coerce.boolean().default(false),
});

export const CreateCategorySchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  price: z.coerce.number().min(0),
  currency: CurrencySchema,
  supply: z.coerce.number().int().positive(),
  max_resale_price: z.coerce.number().min(0).optional().nullable(),
  resale_enabled: z.coerce.boolean().default(true),
  benefits: z.string().max(1000).optional().nullable(),
});

export const PurchaseInitSchema = z.object({
  category_id: z.string().uuid(),
});

export const ResellInitSchema = z.object({
  ticket_id: z.string().uuid(),
  price: z.coerce.number().min(0),
});

export const RefundSchema = z.object({
  ticket_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const AdminTopupSchema = z.object({
  profile_id: z.string().uuid(),
  currency: CurrencySchema,
  amount: z.coerce.number().positive(),
  topup_request_id: z.string().uuid(),
});

export const InviteControllerSchema = z.object({
  event_id: z.string().uuid(),
  email: z.string().email(),
});

export const OpenGateSchema = z.object({
  event_id: z.string().uuid(),
  gate_name: z.string().max(80).optional().nullable(),
  ttl_hours: z.coerce.number().int().min(1).max(24).optional(),
});

export const RedeemConfirmSchema = z.object({
  gate_short_code: z.string().min(4).max(16).trim().toUpperCase(),
  ticket_id: z.string().uuid(),
});

export const RedeemPrepareSchema = z.object({
  gate_short_code: z.string().min(4).max(16).trim().toUpperCase(),
  ticket_id: z.string().uuid(),
});
