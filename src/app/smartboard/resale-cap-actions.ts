"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { requireActiveAdminOrganization } from "@/lib/organizations/context";
import { createServiceClient } from "@/lib/supabase/service";

function fail(message: string): never {
  redirect(`/smartboard?tab=resale&error=${encodeURIComponent(message)}`);
}

export async function setResaleCapAction(formData: FormData) {
  const profile = await requireRole("organizer");
  const { activeOrganization } = await requireActiveAdminOrganization(profile);

  const bps = Math.round(Number(formData.get("resale_cap_bps")));
  if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
    fail("Resale cap must be between 0 and 10000 basis points.");
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("organizations")
    .update({ resale_cap_bps: bps })
    .eq("id", activeOrganization.id);
  if (error) fail(error.message);

  revalidatePath("/smartboard");
  redirect("/smartboard?tab=resale");
}
