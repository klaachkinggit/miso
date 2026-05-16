// Mapping layer for user-facing API errors. Internal `Error.message`
// values can leak DB column names, Thirdweb error payloads, etc. The
// HTTP routes call `safeErrorMessage(err)` so callers get a stable,
// minimal description while the full error is captured server-side
// via `console.error` for debugging.

export interface SafeErrorOptions {
  // Override the default "Request failed" when no rule matches.
  fallback?: string;
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
  /^Insufficient Account Balance\./,
  /^Resale price exceeds max /,
  /^Cannot refund/i,
  /^Already refunded/i,
];

export function safeErrorMessage(err: unknown, opts: SafeErrorOptions = {}): string {
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
