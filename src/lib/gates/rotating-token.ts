import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Rotating gate token (P2): a short-lived HMAC token embedded in the gate's QR so
// a screenshot or shared `/redeem/{code}` link goes stale within ~2 minutes,
// forcing the attendee to be physically at the gate scanning the live QR. The
// gate session's short_code stays the routing key; the token is the freshness
// proof, verified server-side at redeem-confirm.
//
// Env-gated: without MISO_GATE_ROTATION_SECRET the feature is OFF — tokens are
// not issued and verification is a no-op (accept) — so existing gates keep working.
// Stateless: token = HMAC(gateSessionId:timeBucket, secret); no DB, no schema change.

const TOKEN_LEN = 12; // base64url chars

function secret(): string | null {
  const s = process.env.MISO_GATE_ROTATION_SECRET;
  return s && s.length > 0 ? s : null;
}

function periodSeconds(): number {
  const n = Number(process.env.MISO_GATE_ROTATION_PERIOD_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

// Accept the current bucket plus this many previous buckets, so a token stays
// valid for ~(TOLERANCE_BUCKETS + 1) * period — room for login + ticket pick
// without letting an old screenshot work minutes later.
const TOLERANCE_BUCKETS = 1;

export function gateRotationEnabled(): boolean {
  return secret() !== null;
}

export function gateRotationPeriodSeconds(): number {
  return periodSeconds();
}

function bucketToken(
  gateSessionId: string,
  bucket: number,
  key: string,
): string {
  return createHmac("sha256", key)
    .update(`${gateSessionId}:${bucket}`)
    .digest("base64url")
    .slice(0, TOKEN_LEN);
}

/** Current token for a gate session, or null when rotation is disabled. */
export function currentGateToken(
  gateSessionId: string,
  nowMs: number = Date.now(),
): string | null {
  const key = secret();
  if (!key) return null;
  const bucket = Math.floor(nowMs / 1000 / periodSeconds());
  return bucketToken(gateSessionId, bucket, key);
}

/** True if `token` is valid for the gate within the tolerance window. No-op (true) when disabled. */
export function verifyGateToken(
  gateSessionId: string,
  token: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const key = secret();
  if (!key) return true; // rotation disabled → accept
  if (!token) return false;
  const period = periodSeconds();
  const bucket = Math.floor(nowMs / 1000 / period);
  const candidate = Buffer.from(token);
  for (let i = 0; i <= TOLERANCE_BUCKETS; i++) {
    const expected = Buffer.from(bucketToken(gateSessionId, bucket - i, key));
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    )
      return true;
  }
  return false;
}
