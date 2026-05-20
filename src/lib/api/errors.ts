import { NextResponse } from "next/server";

// Mapping layer for user-facing API errors. Internal `Error.message`
// values can leak DB column names, Thirdweb error payloads, etc. The
// HTTP routes call `safeErrorMessage(err)` so callers get a stable,
// minimal description while the full error is captured server-side
// via `console.error` for debugging.

export interface SafeErrorOptions {
  // Override the default "Request failed" when no rule matches.
  fallback?: string;
}

export class ApiRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

function safeErrorMessage(err: unknown, opts: SafeErrorOptions = {}): string {
  const fallback = opts.fallback ?? "Request failed.";
  if (err instanceof DomainError) return err.message;
  // Log the full error server-side so on-call engineers can correlate
  // — never expose it to the client.
  console.error("[api] suppressed error:", err);
  return fallback;
}

export function apiErrorResponse(
  err: unknown,
  opts: SafeErrorOptions & { status?: number } = {},
): NextResponse<{ error: string }> {
  if (err instanceof ApiRouteError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: safeErrorMessage(err, opts) },
    { status: opts.status ?? 400 },
  );
}
