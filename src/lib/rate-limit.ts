import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Abuse protection (P0.6). Sliding-window limits backed by Upstash Redis.
//
// No-op by design when UPSTASH_REDIS_REST_URL/TOKEN are unset: local, CI, and
// any environment without Redis stay unthrottled rather than broken. Redis
// errors fail OPEN — a rate-limiter outage must never take down checkout or
// auth.

const RATE_LIMITS = {
  // Authenticated, per-user: payment + listing churn.
  checkout: { limit: 12, window: "60 s" },
  onboarding: { limit: 6, window: "60 s" },
  listing: { limit: 20, window: "60 s" },
  // Per-organizer: outbound-email amplifier (1 request -> up to N sends).
  announce: { limit: 3, window: "3600 s" },
  // Per-user: follow/unfollow churn.
  follow: { limit: 30, window: "60 s" },
  // Unauthenticated, per-IP: credential stuffing / signup spam.
  auth: { limit: 10, window: "60 s" },
  // AI chat (copilot per-user, buyer assistant per-IP): token-cost amplifier.
  ai: { limit: 20, window: "60 s" },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

let redisClient: Redis | null | undefined;
const limiterCache = new Map<RateLimitBucket, Ratelimit>();

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function getLimiter(bucket: RateLimitBucket): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cached = limiterCache.get(bucket);
  if (cached) return cached;
  const cfg = RATE_LIMITS[bucket];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
    prefix: `miso:rl:${bucket}`,
    analytics: false,
  });
  limiterCache.set(bucket, limiter);
  return limiter;
}

export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<{ allowed: boolean }> {
  const limiter = getLimiter(bucket);
  if (!limiter) return { allowed: true };
  try {
    const { success } = await limiter.limit(identifier);
    return { allowed: success };
  } catch {
    return { allowed: true };
  }
}

// Best-effort client IP for unauthenticated (per-IP) limits.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

export function rateLimitedResponseBody() {
  return { error: "Too many requests. Please slow down and try again." };
}
