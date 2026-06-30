import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";
import type { OrganizerProfile, Profile } from "@/types/db";
import {
  getSellerAccountByUserId,
  type StripeSellerAccountRow,
} from "@/lib/stripe-marketplace/seller-accounts";

export const EVENT_TYPOLOGY_OPTIONS = [
  { value: "clubbing", label: "Clubbing" },
  { value: "open_air_warehouse", label: "Open Air & Warehouse" },
  { value: "concerts", label: "Concerts" },
  { value: "festivals", label: "Festivals" },
  { value: "autre", label: "Autre" },
] as const;

export const VOLUME_ESTIMATION_OPTIONS = [
  { value: "un_seul", label: "Un seul" },
  { value: "jusqua_10", label: "Jusqu'a 10" },
  { value: "de_11_a_25", label: "De 11 a 25" },
  { value: "plus_de_25", label: "Plus de 25" },
] as const;

export const TICKETING_FOOTPRINT_OPTIONS = [
  { value: "gratuit", label: "Gratuit" },
  { value: "moins_de_15", label: "Moins de 15 EUR" },
  { value: "quinze_ou_plus", label: "15 EUR ou plus" },
] as const;

const eventTypologyValues = EVENT_TYPOLOGY_OPTIONS.map((o) => o.value) as [
  (typeof EVENT_TYPOLOGY_OPTIONS)[number]["value"],
  ...(typeof EVENT_TYPOLOGY_OPTIONS)[number]["value"][],
];
const volumeValues = VOLUME_ESTIMATION_OPTIONS.map((o) => o.value) as [
  (typeof VOLUME_ESTIMATION_OPTIONS)[number]["value"],
  ...(typeof VOLUME_ESTIMATION_OPTIONS)[number]["value"][],
];
const footprintValues = TICKETING_FOOTPRINT_OPTIONS.map((o) => o.value) as [
  (typeof TICKETING_FOOTPRINT_OPTIONS)[number]["value"],
  ...(typeof TICKETING_FOOTPRINT_OPTIONS)[number]["value"][],
];

export const OrganizerQuestionnaireSchema = z.object({
  event_typology: z.enum(eventTypologyValues),
  volume_estimation: z.enum(volumeValues),
  ticketing_footprint: z.enum(footprintValues),
});

export const OrganizerLegalSchema = z
  .object({
    siret: z.string().trim().max(40).optional().nullable(),
    no_siret: z.coerce.boolean().default(false),
  })
  .refine((value) => value.no_siret || Boolean(value.siret?.trim()), {
    message: "Add a SIRET or confirm you do not have one.",
  })
  .transform((value) => ({
    no_siret: value.no_siret,
    siret: value.no_siret
      ? null
      : normalizeCorporateIdentifier(value.siret ?? ""),
  }))
  .refine(
    (value) => value.no_siret || isCorporateIdentifier(value.siret ?? ""),
    {
      message: "Corporate identifier must be 6-36 letters or numbers.",
    },
  );

export const OrganizerPageSchema = z.object({
  page_name: z.string().trim().min(2).max(80),
  page_slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must use lowercase letters, numbers, and hyphens.",
    ),
  page_description: z.string().trim().max(700).optional().nullable(),
  widget_accent_color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color."),
});

export type OrganizerQuestionnaireInput = z.infer<
  typeof OrganizerQuestionnaireSchema
>;

export interface OrganizerCompliance {
  organizer: OrganizerProfile | null;
  seller: StripeSellerAccountRow | null;
  legalReady: boolean;
  stripeReady: boolean;
  live: boolean;
}

export function normalizeCorporateIdentifier(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isCorporateIdentifier(value: string): boolean {
  const normalized = normalizeCorporateIdentifier(value).replace(/[ -]/g, "");
  return /^[A-Z0-9]{6,36}$/.test(normalized);
}

export function isSellerPayoutReady(
  seller: StripeSellerAccountRow | null,
): boolean {
  return Boolean(
    seller?.charges_enabled &&
    seller.payouts_enabled &&
    seller.details_submitted &&
    seller.seller_risk_status === "clear",
  );
}

export function isOrganizerLegalReady(
  organizer: Pick<OrganizerProfile, "siret" | "no_siret"> | null,
): boolean {
  return Boolean(organizer && (organizer.no_siret || organizer.siret));
}

export async function getOrganizerProfile(
  userId: string,
): Promise<OrganizerProfile | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organizer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<OrganizerProfile>();
  if (error) throw error;
  return data ?? null;
}

export async function getOrganizerCompliance(
  userId: string,
): Promise<OrganizerCompliance> {
  const [organizer, seller] = await Promise.all([
    getOrganizerProfile(userId),
    getSellerAccountByUserId(userId),
  ]);
  const legalReady = isOrganizerLegalReady(organizer);
  const stripeReady = isSellerPayoutReady(seller);
  return {
    organizer,
    seller,
    legalReady,
    stripeReady,
    live: Boolean(organizer?.status === "live" && legalReady && stripeReady),
  };
}

export async function refreshOrganizerLiveStatus(
  userId: string,
): Promise<OrganizerProfile | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("refresh_organizer_live_status", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data as OrganizerProfile | null) ?? null;
}

export async function createSandboxOrganizer(params: {
  profile: Profile;
  input: OrganizerQuestionnaireInput;
}): Promise<OrganizerProfile> {
  if (params.profile.role === "controller") {
    throw new Error("Controller profiles cannot become organizers.");
  }
  if (params.profile.role === "admin") {
    throw new Error("Admin profiles use the platform admin workspace.");
  }

  const sb = createServiceClient();
  const pageName =
    params.profile.display_name ??
    params.profile.email.split("@")[0] ??
    "Organizer";
  const pageSlug = slugify(`${pageName}-${params.profile.id.slice(0, 8)}`);

  const { error: roleError } = await sb
    .from("profiles")
    .update({ role: "organizer" })
    .eq("id", params.profile.id)
    .neq("role", "admin")
    .neq("role", "controller");
  if (roleError) throw roleError;

  const { data, error } = await sb
    .from("organizer_profiles")
    .upsert(
      {
        user_id: params.profile.id,
        ...params.input,
        status: "sandbox",
        page_name: pageName,
        page_slug: pageSlug,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single<OrganizerProfile>();
  if (error || !data)
    throw error ?? new Error("Organizer profile could not be created.");
  return data;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `organizer-${Date.now().toString(36)}`;
}
