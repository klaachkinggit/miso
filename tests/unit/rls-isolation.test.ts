import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// RLS isolation (P0.6): the anon Supabase role must not read the sensitive
// financial tables. They are RLS-enabled with `revoke all from anon,
// authenticated`, so an anon select returns either a permission error or an
// empty set — never a row.
//
// Gated on env so it runs against a live local/staging Supabase and skips in
// the CI quality job (which has no Supabase). Run locally with:
//   RLS_TEST_SUPABASE_URL=$(npx supabase status -o env | ...) \
//   RLS_TEST_ANON_KEY=...  npx vitest run tests/unit/rls-isolation.test.ts

const url = process.env.RLS_TEST_SUPABASE_URL;
const anonKey = process.env.RLS_TEST_ANON_KEY;
const enabled = Boolean(url && anonKey);

const SENSITIVE_TABLES = [
  "marketplace_payments",
  "marketplace_payment_items",
  "marketplace_transfers",
  "stripe_seller_accounts",
];

describe.skipIf(!enabled)(
  "RLS isolation — anon cannot read sensitive tables",
  () => {
    for (const table of SENSITIVE_TABLES) {
      it(`anon select on ${table} leaks no rows`, async () => {
        const anon = createClient(url ?? "", anonKey ?? "", {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await anon.from(table).select("*").limit(1);
        const leaked = !error && (data?.length ?? 0) > 0;
        expect(leaked).toBe(false);
      });
    }
  },
);
