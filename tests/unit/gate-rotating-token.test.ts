import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentGateToken,
  gateRotationEnabled,
  verifyGateToken,
} from "@/lib/gates/rotating-token";

const NOW = 1_700_000_400_000; // fixed ms (a round bucket boundary at 60s period)
const PERIOD_MS = 60_000;
const GATE = "gate-abc";

afterEach(() => vi.unstubAllEnvs());

describe("rotating gate token — disabled (no secret)", () => {
  it("is off and verification is a no-op (accept)", () => {
    expect(gateRotationEnabled()).toBe(false);
    expect(currentGateToken(GATE, NOW)).toBeNull();
    expect(verifyGateToken(GATE, undefined, NOW)).toBe(true);
    expect(verifyGateToken(GATE, "whatever", NOW)).toBe(true);
  });
});

describe("rotating gate token — enabled", () => {
  const enable = () =>
    vi.stubEnv("MISO_GATE_ROTATION_SECRET", "unit-test-secret");

  it("issues a compact token and verifies the current bucket", () => {
    enable();
    const token = currentGateToken(GATE, NOW);
    expect(gateRotationEnabled()).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(verifyGateToken(GATE, token, NOW)).toBe(true);
  });

  it("accepts the immediately previous bucket (login tolerance) but rejects older", () => {
    enable();
    const token = currentGateToken(GATE, NOW)!;
    expect(verifyGateToken(GATE, token, NOW + PERIOD_MS)).toBe(true); // 1 bucket later → still ok
    expect(verifyGateToken(GATE, token, NOW + 3 * PERIOD_MS)).toBe(false); // stale screenshot
  });

  it("rejects a token minted for a different gate, and a missing token", () => {
    enable();
    const token = currentGateToken(GATE, NOW)!;
    expect(verifyGateToken("other-gate", token, NOW)).toBe(false);
    expect(verifyGateToken(GATE, null, NOW)).toBe(false);
    expect(verifyGateToken(GATE, "", NOW)).toBe(false);
  });
});
