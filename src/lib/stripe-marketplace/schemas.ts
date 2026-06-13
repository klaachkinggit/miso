import { z } from "zod";

export const PrimaryCheckoutInitSchema = z.object({
  category_id: z.string().uuid(),
});

export const ResaleCheckoutInitSchema = z.object({
  listing_id: z.string().uuid(),
});

export const OnboardingLinkInitSchema = z.object({
  return_path: z.string().startsWith("/").max(200).optional(),
});

export type PrimaryCheckoutInit = z.infer<typeof PrimaryCheckoutInitSchema>;
export type ResaleCheckoutInit = z.infer<typeof ResaleCheckoutInitSchema>;
export type OnboardingLinkInit = z.infer<typeof OnboardingLinkInitSchema>;
