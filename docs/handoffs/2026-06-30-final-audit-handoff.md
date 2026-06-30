# 2026-06-30 Final Audit Handoff

Branch: `chore/ponytail-loc-reduction`

Status: full local audit loop completed with sub-agent verification and harness skills. No commit or staging was performed. The worktree was already heavily dirty before this final verification pass; review provenance before staging or reverting anything.

## Current Verdict

No blocking security, harness, type, lint, unit-test, build, or actionable dead-code findings remain after the last audit loop.

Remaining nonzero audit-tool output is manual triage noise: framework entrypoints, generated DB helper types, public embed/email surfaces, package-profile dependency declarations, and intentionally exported internal-library APIs. Dependency drift exists, but `npm audit --audit-level=high` is clean.

## Final Fix Loop Applied

- Controller gate QR origin no longer trusts raw `host` / `x-forwarded-proto`; `src/app/controller/[eventId]/page.tsx` now uses `getConfiguredAppUrl()`.
- Global client error page no longer renders raw `error.message`.
- Login, buyer signup, and organizer signup no longer reflect Supabase auth provider messages into redirect query strings.
- Dialog content now has mobile viewport overflow containment and the close button uses `focus-visible`.
- Admin analytics clear-filter control gained a visible keyboard focus state.
- Public events filter panel persists expanded/collapsed state in the URL while keeping search input local.
- Stripe card checkout errors now use `role="alert"` and `aria-live="polite"`.
- Removed stale dead code: `assertOrganizationPaymentReadiness`, `getResaleCheckoutListing`, and `ResaleCheckoutPreflightError`.
- Removed generated `tools/__pycache__` after harness runs.

Earlier fixes still present from the starting handoff:

- Gift-recipient checkout no longer enumerates buyer emails.
- Manual Stripe marketplace refunds create the Stripe refund before reversing seller transfers.
- Event metadata no longer leaks inactive-organization event details.
- Analytics event/category breakdowns use selected range/channel purchase data.
- Resale checkout carries `return_path`, `sales_channel`, and `tracking_origin`.
- Gift recipient email is not serialized into checkout URLs.
- Harness/Ponytail package-profile support is repaired and verified.
- `scripts/compact-db-types.ts` preserves compact RPC signatures in `src/types/db.ts`.

## Metrics

Live filesystem LOC, excluding `node_modules`, `.next`, `test-results`, `package-lock.json`, and `tsconfig.tsbuildinfo`:

- Total: 54,142 lines across 510 files.
- By top-level area:
  - `src`: 34,265 lines / 296 files.
  - `tests`: 8,788 lines / 65 files.
  - `supabase`: 3,289 lines / 53 files.
  - `docs`: 1,982 lines / 29 files.
  - `tools`: 1,904 lines / 16 files.
  - `scripts`: 1,780 lines / 6 files.
  - `prompts`: 487 lines / 17 files.
- `src` breakdown:
  - `src/lib`: 16,558 lines / 122 files.
  - `src/app`: 12,044 lines / 122 files.
  - `src/components`: 5,600 lines / 51 files.
  - `src/types`: 63 lines / 1 file.
- By extension:
  - `ts`: 30,131 lines / 235 files.
  - `tsx`: 14,232 lines / 137 files.
  - `md`: 3,245 lines / 57 files.
  - `sql`: 3,242 lines / 52 files.
  - `sh`: 1,858 lines / 15 files.
  - `css`: 683 lines / 1 file.
  - `py`: 407 lines / 2 files.

Complexity/churn notes:

- Largest files remain `scripts/seed.ts` (1,169 LOC), `src/lib/stripe-marketplace/payments.ts` (958), `src/app/admin/actions.ts` (938), `src/app/smartboard/page.tsx` (917), and `src/lib/tickets/lifecycle.ts` (714).
- 90-day churn hotspots remain `docs/CONTEXT.md`, `src/lib/resale/listing.ts`, `src/types/db.ts`, `src/app/admin/actions.ts`, `package.json`, `src/lib/schemas.ts`, `scripts/seed.ts`, `src/lib/events/setup.ts`, and checkout/payment modules.
- `git diff --stat` for tracked files currently shows 91 files changed, 785 insertions, 6,579 deletions. This does not include untracked files.

## Security Status

Security/access-control audit is clean for blocking findings after fixes.

Verified:

- High-severity dependency audit: `found 0 vulnerabilities`.
- Hardcoded secret regex scan over `src scripts tools prompts docs .codex .claude`: no matches.
- Controller QR origin uses configured app URL, not request headers.
- Public auth failures return generic messages.
- Global client error page does not expose raw thrown messages.
- Marketplace refund action authorization still derives the event from the payment server-side before authorizing.
- Gift recipient and checkout URL PII fixes remain covered by tests.

Non-blocking notes:

- `src/lib/url.ts` still reads forwarded headers in the dedicated trusted-origin helper; that helper includes environment precedence and `TRUSTED_FORWARDED_HOSTS` allowlisting.
- Debug/TODO scan reports expected script/test logging plus prompt text; no production `debugger` or actionable app TODO was found.

## Architecture Health

CodeGraph audit mapped the high-risk boundaries:

- Next.js App Router pages, server actions, and API routes are the main behavioral surface.
- Supabase service-client reads/writes are concentrated in `src/lib` plus server actions/API routes.
- Stripe marketplace checkout/refund/transfer flows are concentrated in `src/lib/stripe-marketplace`.
- Analytics aggregation is centralized in `src/lib/analytics/organization.ts`.
- Harness behavior is project-local under `tools`, `prompts`, `.codex`, and `.claude`.

Current architecture verdict:

- No verified architecture blocker remains.
- Checkout/payment logic is still intentionally dense. `src/lib/stripe-marketplace/payments.ts` remains the main future refactor candidate because it combines reservation, gift lookup, promo consumption, purchase rows, Stripe intents, audit, and rollback.
- `src/app/admin/actions.ts` remains a large server-action hub. The current audited high-risk refund path is sound, but future changes should keep authorization inside actions because Server Actions are directly POST-reachable.
- Public embed flow is intentionally dependency-free through `public/embed.js`; dead-code tools do not understand that script tag surface.
- Email templates and several `src/lib` exports are reported by `ts-prune`/`knip` because they are public/internal API surfaces or rendered through email-send indirection, not because they are deletion-ready.

## Sub-Agents Used

- `019f189a-dfcd-75b3-825a-adb179b93cdd` security/access audit. Reported controller trusted-origin, global error leakage, and signup auth-message disclosure; all fixed.
- `019f189b-052c-7d02-bb43-507052171e84` LOC/complexity/architecture audit. Reported stale payment-readiness and resale-checkout exports; fixed.
- `019f189b-27e8-78b1-8a55-9572b34f887b` UI/a11y audit using `web-design-guidelines` and `impeccable`. Reported dialog, focus, filter-state, and checkout error-announcement issues; fixed.
- `019f189b-4cc3-7e72-a047-e7fb83000214` independent validation-harness judge. Verified the original command matrix against current repo state.
- `019f18a0-6d23-79e3-82c2-c15d4e090b1a` focused patch verifier. Confirmed the final fixes and ran `npm run typecheck`.

Harness/MCP/skill surfaces used:

- CodeGraph for architecture/dependency mapping and code-aware reads.
- Sequential-thinking MCP for audit-loop planning.
- Context7 for current Next.js Server Actions / metadata security guidance.
- Local `web-design-guidelines` and `impeccable` skills for UI/a11y review.
- Repo harness prompts: `assess-capabilities`, `audit`, `security-scan`, `preflight`, `subagent`, and `risk-review`.

## Final Verification

Passed in parent thread after the final patch loop:

- `git diff --check`
- `npm audit --audit-level=high`
- `npm ls ponytail --depth=0`
- `tools/check-profile.sh ponytail`
- `tools/audit-capabilities.sh --expect-profile ponytail`
- `tools/test-harness-integration.sh`
- `tools/preflight-harness.sh`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
  - 61 files passed, 1 skipped.
  - 449 tests passed, 4 skipped.
- `npm run contracts:compile`
- `npm run build`

Build caveats:

- `npm run build` exits 0.
- It still prints the existing Sentry warning about missing App Router global error handler instrumentation.
- It still logs three local Supabase `ECONNREFUSED 127.0.0.1:54321` fetch failures during static generation, then completes successfully.

Additional audit scans:

- `npm outdated --json` reports dependency drift, including major-version drift for Next 16, AI SDK 7, Tailwind 4, TypeScript 6, and minor/patch drift for Radix, Supabase, Stripe, test, and tooling packages. No high vulnerability accompanies this drift.
- `npm exec -- ts-prune --ignore '(^\\.next/|^next-env\\.d\\.ts$)'` still reports framework entrypoints, generated DB helper types, email/template exports, and library exports. The previously actionable stale exports are gone.
- `npm exec -- knip --reporter compact` still reports:
  - `public/embed.js` as unused, false positive for script-tag embed surface.
  - `ponytail` as unused, intentional package-profile dependency.
  - `react-email` as unused, CLI/dev dependency with `@react-email/components` used by templates.
  - 26 unused exports and 6 unused exported type groups, manual triage only.
- `rg -n "console\\.log|debugger|breakpoint\\(\\)|pdb|TODO|FIXME|HACK" src tests scripts tools prompts docs` reports scripts/tests/prompts/handoff text only.

## Worktree Caveats

- No commit/stage was performed.
- If committing, explicitly add untracked dependencies and handoffs:
  - `docs/handoffs/2026-06-27-final-audit-handoff.md`
  - `docs/handoffs/2026-06-30-final-audit-handoff.md`
  - `scripts/compact-db-types.ts`
  - `src/app/s/[organizationSlug]/buyer.ts`
  - `src/lib/query-string.ts`
  - `tests/unit/event-metadata.test.ts`
  - `tools/hooks/*.sh`
  - `tools/profile.py`
- `package-lock.json` is unchanged after installing `ponytail`; `package.json` is modified and local `node_modules` contains `ponytail@1.0.57`.
- Dirty/deleted files include docs, harness mirrors, generated screenshots, old alias/export files, and many app/lib changes. Do not assume every dirty file belongs to one audit subtask.
- `tools/__pycache__` can be regenerated by harness Python compile checks; remove it before staging if it reappears.

## Next-Agent Final Verification

Run this exact final verification from repo root:

```sh
git status --short --branch
git diff --check
npm audit --audit-level=high
npm ls ponytail --depth=0
tools/check-profile.sh ponytail
tools/audit-capabilities.sh --expect-profile ponytail
tools/test-harness-integration.sh
tools/preflight-harness.sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
find tools -name '__pycache__' -o -name '*.pyc'
```

Expected result: every command passes except the final `find`, which should print nothing after cleanup. If `tools/__pycache__` appears, delete it and rerun `git status --short --branch`.
