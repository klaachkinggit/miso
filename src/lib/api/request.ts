import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ApiRouteError } from "@/lib/api/errors";

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
  invalidMessage: string,
): Promise<z.infer<TSchema>> {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiRouteError(invalidMessage, 400);
  return parsed.data;
}
