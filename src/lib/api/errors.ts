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

const PASSTHROUGH_PATTERNS: RegExp[] = [
  /^Authentication required\./,
  /^Controllers cannot/i,
  /^Cannot buy your own listing/i,
  /^Not (listing|ticket) owner/i,
  /^Sales not open/i,
  /^Sold out/i,
  /^No tickets available/i,
  /^Listing (not active|not found|is no longer)/i,
  /^Ticket cannot be (listed|transferred)/i,
  /^Ticket is /,
  /^Event (canceled|already passed|has been canceled)/i,
  /^Resale not enabled/i,
  /^Resale price exceeds max /,
  /^Cannot refund/i,
  /^Already refunded/i,
];

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function safeErrorMessage(err: unknown, opts: SafeErrorOptions = {}): string {
  const fallback = opts.fallback ?? "Request failed.";
  if (!(err instanceof Error)) return fallback;
  const msg = err.message ?? "";
  for (const pat of PASSTHROUGH_PATTERNS) {
    if (pat.test(msg)) return msg;
  }
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
