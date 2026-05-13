// Shared Thirdweb HTTP client. Server-only.
//
// Auth: `x-secret-key` (account secret) + `x-backend-wallet-address`
// (which server wallet signs). Both are server-only — never ship to
// the client.

const THIRDWEB_API_URL =
  process.env.THIRDWEB_API_URL ?? "https://api.thirdweb.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export class ThirdwebError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ThirdwebError";
  }
}

export interface ThirdwebFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  includeBackendWallet?: boolean;
}

export async function thirdwebFetch<T>(
  path: string,
  opts: ThirdwebFetchOptions = {},
): Promise<T> {
  const secretKey = requireEnv("THIRDWEB_SECRET_KEY");
  const headers: Record<string, string> = {
    "x-secret-key": secretKey,
    "content-type": "application/json",
    accept: "application/json",
  };
  if (opts.includeBackendWallet !== false) {
    headers["x-backend-wallet-address"] = requireEnv(
      "THIRDWEB_BACKEND_WALLET_ADDRESS",
    );
  }

  const url = `${THIRDWEB_API_URL}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ThirdwebError(
      `Thirdweb ${opts.method ?? "GET"} ${path} failed: ${res.status}`,
      res.status,
      body ?? text,
    );
  }

  return (body ?? {}) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
