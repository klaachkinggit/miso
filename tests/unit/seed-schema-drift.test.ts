import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard: the seed script must reference the canonical
// `purchases` columns that exist in the live schema. Earlier
// migrations carried `stripe_checkout_session_id`; payments refactor
// renamed it to `provider_session_id`. The seed broke silently when
// we wiped the local volume and rebuilt from migrations.
//
// We pin the seed against the latest migration that defines these
// columns rather than the schema cache, since the cache only exists
// at runtime.

const repoRoot = join(__dirname, "..", "..");
const seedSource = readFileSync(join(repoRoot, "scripts", "seed.ts"), "utf8");
const paymentsRefactorMigration = readFileSync(
  join(repoRoot, "supabase", "migrations", "0005_payments_refactor.sql"),
  "utf8",
);
const idempotencyMigration = readFileSync(
  join(repoRoot, "supabase", "migrations", "20260518015633_purchase_checkout_idempotency.sql"),
  "utf8",
);

describe("seed — purchases column drift", () => {
  it("does not use the retired stripe_checkout_session_id column", () => {
    expect(seedSource).not.toMatch(/stripe_checkout_session_id/);
  });

  it("does not use the retired stripe_payment_intent_id column", () => {
    expect(seedSource).not.toMatch(/stripe_payment_intent_id/);
  });

  it("uses the current provider_session_id column from the payments refactor", () => {
    expect(seedSource).toMatch(/provider_session_id/);
    expect(paymentsRefactorMigration).toMatch(/provider_session_id/);
  });

  it("uses the current provider_payment_id column", () => {
    expect(seedSource).toMatch(/provider_payment_id/);
  });

  it("sets payment_provider so purchases pass schema-level checks", () => {
    expect(seedSource).toMatch(/payment_provider/);
  });

  it("populates checkout_idempotency_key introduced by the idempotency migration", () => {
    expect(seedSource).toMatch(/checkout_idempotency_key/);
    expect(idempotencyMigration).toMatch(/checkout_idempotency_key/);
  });
});

describe("seed — demo account contract", () => {
  it("declares the three primary demo accounts (buyer, organizer, admin)", () => {
    expect(seedSource).toMatch(/buyer@miso\.local/);
    expect(seedSource).toMatch(/organizer@miso\.local/);
    expect(seedSource).toMatch(/admin@miso\.local/);
  });

  it("calls ensureBuyerOwnsTickets so the buyer demo has tickets in their wallet", () => {
    expect(seedSource).toMatch(/ensureBuyerOwnsTickets\(/);
  });

  it("marks claimed tickets as sold with an owner and minted timestamp", () => {
    expect(seedSource).toMatch(/status:\s*"sold"/);
    expect(seedSource).toMatch(/owner_user_id:\s*buyerUserId/);
    expect(seedSource).toMatch(/minted_at:/);
  });
});
