"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOrganizationForAdmin } from "@/lib/organizations/setup";
import { ensureUserWallet } from "@/lib/thirdweb/wallet";
import type { OrganizerOnboardingAnswers } from "@/lib/payments/stripe-connect";
import type { Json } from "@/types/db";

const OrganizerSignupSchema = z.object({
  display_name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  organization_name: z.string().min(2).max(160),
  event_types: z.string().min(2).max(1000),
  expected_monthly_attendees: z.string().optional().nullable(),
  country: z.string().length(2).transform((v) => v.toUpperCase()),
  website: z.string().url().optional().or(z.literal("")).nullable(),
});

function fail(message: string): never {
  redirect(`/signup/organizer?error=${encodeURIComponent(message)}`);
}

export async function organizerSignupAction(formData: FormData) {
  const parsed = OrganizerSignupSchema.safeParse({
    display_name: formData.get("display_name"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    organization_name: formData.get("organization_name"),
    event_types: formData.get("event_types"),
    expected_monthly_attendees: formData.get("expected_monthly_attendees") || null,
    country: formData.get("country"),
    website: formData.get("website") || null,
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid organizer details.");
  const input = parsed.data;

  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.display_name },
    },
  });
  if (error) fail(error.message);

  const userId = data?.user?.id;
  if (!userId) fail("Signup did not return a user.");

  const onboarding: OrganizerOnboardingAnswers = {
    organization_name: input.organization_name,
    event_types: input.event_types,
    expected_monthly_attendees: input.expected_monthly_attendees || null,
    country: input.country,
    website: input.website || null,
  };

  const service = createServiceClient();
  const { error: profileError } = await service
    .from("profiles")
    .update({ display_name: input.display_name })
    .eq("id", userId);
  if (profileError) fail(profileError.message);

  try {
    await createOrganizationForAdmin({
      name: input.organization_name,
      adminUserId: userId,
      onboarding: onboarding as unknown as Json,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : "Organization could not be created.");
  }

  try {
    await ensureUserWallet(userId, input.email);
  } catch (err) {
    console.error("ensureUserWallet failed at organizer signup", err);
  }

  redirect("/signup/organizer/stripe");
}
