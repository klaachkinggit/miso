"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { getCurrentProfile } from "@/lib/auth";
import {
  createSandboxOrganizer,
  OrganizerQuestionnaireSchema,
} from "@/lib/organizers/profile";

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function chooseStandardUser() {
  redirect("/events");
}

export async function startOrganizerOnboarding(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const parsed = OrganizerQuestionnaireSchema.safeParse({
    event_typology: formData.get("event_typology"),
    volume_estimation: formData.get("volume_estimation"),
    ticketing_footprint: formData.get("ticketing_footprint"),
  });
  if (!parsed.success) {
    fail(
      parsed.error.issues[0]?.message ??
        "Complete the organizer questionnaire.",
    );
  }

  try {
    await createSandboxOrganizer({ profile, input: parsed.data });
    await audit({
      actorUserId: profile.id,
      action: "organizer.self_declared",
      entityType: "profile",
      entityId: profile.id,
      metadata: parsed.data,
    });
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : "Organizer onboarding could not be started.",
    );
  }

  redirect("/smartboard");
}
