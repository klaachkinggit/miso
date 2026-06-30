import { NextResponse, type NextRequest } from "next/server";
import { streamText } from "ai";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { getActiveOrganizationBySlug } from "@/lib/organizations/public";
import {
  clientIp,
  enforceRateLimit,
  rateLimitedResponseBody,
} from "@/lib/rate-limit";
import { aiChatEnabled, chatModel } from "@/lib/ai/client";
import { assistantSystemPrompt } from "@/lib/ai/prompts";
import { AssistantRequestSchema } from "@/lib/ai/schemas";
import { retrieveOrgContext } from "@/lib/ai/retrieval";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceRateLimit("ai", await clientIp())).allowed) {
      return NextResponse.json(rateLimitedResponseBody(), { status: 429 });
    }

    const body = await parseJsonBody(
      request,
      AssistantRequestSchema,
      "Invalid request.",
    );

    const org = await getActiveOrganizationBySlug(body.organizationSlug);
    if (!org) throw new ApiRouteError("Organization not found.", 404);

    if (!aiChatEnabled()) {
      return NextResponse.json(
        { error: "AI is not configured." },
        { status: 503 },
      );
    }

    const lastUser = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");
    // ORG ISOLATION: retrieval is scoped to org.id resolved from the slug
    // server-side — never a client-supplied id.
    const chunks = lastUser
      ? await retrieveOrgContext(org.id, lastUser.content)
      : [];
    const context = chunks.map((c) => c.content).join("\n\n");

    const result = streamText({
      model: chatModel()!,
      system: assistantSystemPrompt(org.name, context),
      messages: body.messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Assistant request failed." });
  }
}
