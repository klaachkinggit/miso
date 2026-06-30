import { z } from "zod";

export const PrimaryCheckoutInitSchema = z.object({
  category_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).default(1),
  extra_guests_count: z.number().int().min(0).default(0),
  gift_recipient_email: z.string().email().optional().nullable(),
  return_path: z.string().startsWith("/").max(200).optional(),
  promo: z.string().trim().min(1).max(64).optional(),
});

export const ResaleCheckoutInitSchema = z.object({
  listing_id: z.string().uuid(),
  return_path: z.string().startsWith("/").max(200).optional(),
});

export const OnboardingLinkInitSchema = z.object({
  return_path: z.string().startsWith("/").max(200).optional(),
});

export type PrimaryCheckoutInit = z.infer<typeof PrimaryCheckoutInitSchema>;
export type ResaleCheckoutInit = z.infer<typeof ResaleCheckoutInitSchema>;
export type OnboardingLinkInit = z.infer<typeof OnboardingLinkInitSchema>;
