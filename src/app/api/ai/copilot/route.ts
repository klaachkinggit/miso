import { NextResponse, type NextRequest } from "next/server";
import { streamText } from "ai";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { getOrganizationRole } from "@/lib/organizations/auth";
import { enforceRateLimit, rateLimitedResponseBody } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { aiChatEnabled, chatModel } from "@/lib/ai/client";
import { copilotSystemPrompt } from "@/lib/ai/prompts";
import { CopilotRequestSchema } from "@/lib/ai/schemas";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    const body = await parseJsonBody(
      request,
      CopilotRequestSchema,
      "Invalid request.",
    );

    const role = await getOrganizationRole(profile.id, body.organizationId);
    if (role !== "admin") throw new ApiRouteError("Org admin required.", 403);

    if (!(await enforceRateLimit("ai", profile.id)).allowed) {
      return NextResponse.json(rateLimitedResponseBody(), { status: 429 });
    }

    if (!aiChatEnabled()) {
      return NextResponse.json(
        { error: "AI is not configured." },
        { status: 503 },
      );
    }

    const sb = createServiceClient();
    const { data: org } = await sb
      .from("organizations")
      .select("name")
      .eq("id", body.organizationId)
      .maybeSingle<{ name: string }>();

    const result = streamText({
      model: chatModel()!,
      system: copilotSystemPrompt(org?.name ?? "your organization"),
      messages: body.messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Copilot request failed." });
  }
}
