"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { requireActiveAdminOrganization } from "@/lib/organizations/context";
import { isValidThemeKey, themeJson } from "@/lib/organizations/theme";
import { createServiceClient } from "@/lib/supabase/service";

function fail(message: string): never {
  redirect(`/smartboard?tab=theme&error=${encodeURIComponent(message)}`);
}

export async function saveOrganizationThemeAction(formData: FormData) {
  const profile = await requireRole("organizer");
  const { activeOrganization } = await requireActiveAdminOrganization(profile);

  const key = formData.get("theme");
  if (!isValidThemeKey(key)) fail("Choose a valid storefront theme.");

  const sb = createServiceClient();
  const { error } = await sb
    .from("organizations")
    .update({ theme: themeJson(key) })
    .eq("id", activeOrganization.id);
  if (error) fail(error.message);

  revalidatePath("/smartboard");
  revalidatePath(`/s/${activeOrganization.slug}`);
  redirect("/smartboard?tab=theme&saved=1");
}
