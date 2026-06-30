import React from "react";
import { NextResponse, type NextRequest } from "next/server";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { getActiveOrganizationBySlug } from "@/lib/organizations/public";
import {
  clientIp,
  enforceRateLimit,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/email/client";
import { createServiceClient } from "@/lib/supabase/service";
import { EscalateRequestSchema } from "@/lib/ai/schemas";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceRateLimit("ai", await clientIp())).allowed) {
      return NextResponse.json(rateLimitedResponseBody(), { status: 429 });
    }

    const body = await parseJsonBody(
      request,
      EscalateRequestSchema,
      "Invalid request.",
    );

    const org = await getActiveOrganizationBySlug(body.organizationSlug);
    if (!org) throw new ApiRouteError("Organization not found.", 404);

    const sb = createServiceClient();
    // Schema's organization_role enum is "admin" | "controller" (no "owner");
    // admin is the highest role and the correct escalation target.
    const { data: membership } = await sb
      .from("organization_memberships")
      .select("profiles(email)")
      .eq("organization_id", org.id)
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ profiles: { email: string } | null }>();

    const adminEmail = membership?.profiles?.email;
    if (adminEmail) {
      await sendTransactionalEmail({
        to: adminEmail,
        subject: `New buyer question — ${org.name}`,
        react: React.createElement(
          "div",
          null,
          React.createElement("p", null, `From: ${body.email}`),
          React.createElement("p", null, body.question),
          body.transcript
            ? React.createElement("pre", null, body.transcript)
            : null,
        ),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Escalation failed." });
  }
}
