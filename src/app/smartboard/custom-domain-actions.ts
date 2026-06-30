"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  CustomDomainError,
  setOrganizationCustomDomain,
  verifyOrganizationCustomDomain,
} from "@/lib/organizations/custom-domain";
import { requireActiveAdminOrganization } from "@/lib/organizations/context";

export type CustomDomainActionResult =
  | {
      ok: true;
      domain: string;
      token: string;
      txtRecordName: string;
      verified?: boolean;
    }
  | { ok: false; error: string };

function message(error: unknown, fallback: string): string {
  if (error instanceof CustomDomainError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export async function setCustomDomainAction(
  formData: FormData,
): Promise<CustomDomainActionResult> {
  const profile = await requireRole("organizer");
  const { activeOrganization } = await requireActiveAdminOrganization(profile);

  try {
    const state = await setOrganizationCustomDomain({
      organizationId: activeOrganization.id,
      domain: String(formData.get("domain") ?? ""),
    });
    revalidatePath("/smartboard");
    return { ok: true, ...state };
  } catch (error) {
    return { ok: false, error: message(error, "Domain could not be saved.") };
  }
}

export async function verifyCustomDomainAction(): Promise<CustomDomainActionResult> {
  const profile = await requireRole("organizer");
  const { activeOrganization } = await requireActiveAdminOrganization(profile);

  try {
    const { verified } = await verifyOrganizationCustomDomain({
      organizationId: activeOrganization.id,
    });
    revalidatePath("/smartboard");
    return { ok: true, domain: "", token: "", txtRecordName: "", verified };
  } catch (error) {
    return { ok: false, error: message(error, "Verification failed.") };
  }
}
