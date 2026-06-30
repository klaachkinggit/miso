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
  join(
    repoRoot,
    "supabase",
    "migrations",
    "20260518015633_purchase_checkout_idempotency.sql",
  ),
  "utf8",
);
const organizationFoundationMigration = readFileSync(
  join(
    repoRoot,
    "supabase",
    "migrations",
    "20260605004939_organization_foundation.sql",
  ),
  "utf8",
);

describe("seed — purchases column drift", () => {
  it.each([/stripe_checkout_session_id/, /stripe_payment_intent_id/])(
    "does not use retired column %s",
    (column) => expect(seedSource).not.toMatch(column),
  );

  it.each([
    [/provider_session_id/, paymentsRefactorMigration],
    [/checkout_idempotency_key/, idempotencyMigration],
  ])(
    "uses current seeded column %s from its migration",
    (column, migration) => {
      expect(seedSource).toMatch(column);
      expect(migration).toMatch(column);
    },
  );

  it.each([/provider_payment_id/, /payment_provider/])(
    "uses required purchases column %s",
    (column) => expect(seedSource).toMatch(column),
  );
});

describe("seed — demo account contract", () => {
  it.each([/buyer@miso\.local/, /organizer@miso\.local/, /admin@miso\.local/])(
    "declares demo account %s",
    (account) => expect(seedSource).toMatch(account),
  );

  it.each([
    /ensureBuyerOwnsTickets\(/,
    /status:\s*"sold"/,
    /owner_user_id:\s*buyerUserId/,
    /minted_at:/,
  ])("keeps buyer wallet fixture contract %s", (pattern) =>
    expect(seedSource).toMatch(pattern),
  );

  it("seeds the Miso organization contract introduced by the platform migration", () => {
    expect(organizationFoundationMigration).toMatch(
      /create table if not exists organizations/,
    );
    expect(seedSource).toMatch(/ensureMisoOrganization/);
    expect(seedSource).toMatch(/organization_memberships/);
    expect(seedSource).toMatch(/organization_id:\s*organizationId/);
  });
});
