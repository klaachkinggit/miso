# 2026-06-27 Final Audit Handoff

Branch: `chore/ponytail-loc-reduction`
Scope: current working tree, including the uncommitted LOC-reduction/harness changes.
Purpose: let the next agent verify this audit, catch subagent mistakes, and decide what must be fixed before this branch is committed or opened as a PR.

## Method

Harness prompts used as criteria:

- `prompts/assess-capabilities.md`
- `prompts/audit.md`
- `prompts/security-scan.md`
- `prompts/preflight.md`
- UI audit used local `web-design-guidelines` skill and the current Vercel Web Interface Guidelines source.

Tools/capabilities used:

- CodeGraph for source navigation because `.codegraph/` exists.
- Four subagents split by security/access control, LOC/clean-code, architecture/data/payments, and frontend/a11y.
- Local verification commands listed below.

Subagents:

- Security/access control: `019f04a1-37ee-7ba1-b533-5e502a70032c`
- LOC/clean-code: `019f04a1-52ff-75e2-8452-e0a68421d9f6`
- Architecture/data/payments: `019f04a1-70f3-7473-bd4a-3230de4bc838`
- Frontend/a11y/UI: `019f04a1-8c08-7e11-8133-4668cd67b559`

## Verification Already Run

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` -> 60 passed, 1 skipped; 443 passed, 4 skipped.
- `npm run build`
- `tools/preflight-harness.sh`
- `npm audit --audit-level=high` -> 0 vulnerabilities.
- `git diff --check`

Caveats:

- `npm exec -- ts-prune` was noisy and included `.next/types`; do not treat its raw output as a dead-code truth source without rerunning with better exclusions.
- `gh run list --limit 30` reported 18 recent CI failures named `CI`; local checks above are green, but remote CI history should be reviewed before merging.

Resolved after audit:

- `apply.sh` and `tools/test-harness-integration.sh` executable bits were restored on 2026-06-29.
- `tools/test-harness-integration.sh` and `tools/preflight-harness.sh` were rerun after the mode fix, and both passed.

## LOC / Branch Packaging Findings

### HIGH - branch depends on untracked source files

Evidence:

- `tools/apply-profile.sh`, `tools/check-profile.sh`, and `tools/remove-profile.sh` now exec `tools/profile.py`.
- Provider hook shims now exec shared files in `tools/hooks/`.
- App code imports `src/lib/query-string.ts` and `src/app/s/[organizationSlug]/buyer.ts`.
- Current `git status --short --untracked-files=all` shows all of these as untracked.

Affected untracked files that must be added or inlined before commit:

- `tools/profile.py`
- `tools/hooks/auto-format.sh`
- `tools/hooks/block-dangerous.sh`
- `tools/hooks/log-bash.sh`
- `tools/hooks/pre-pr-gate.sh`
- `tools/hooks/project-scope.sh`
- `tools/hooks/protect-secrets.sh`
- `src/lib/query-string.ts`
- `src/app/s/[organizationSlug]/buyer.ts`
- `scripts/compact-db-types.ts`

Suggested verifier action:

- Confirm every tracked import/exec target exists in git after staging.
- Run `git ls-files --error-unmatch <file>` for each file above after staging.

### RESOLVED - executable bits lost on harness scripts

Evidence:

- Original audit evidence showed `apply.sh` and `tools/test-harness-integration.sh` had changed from `100755` to `100644`.
- Current filesystem mode is executable for both files.

Risk:

- `apply.sh` is an installer entrypoint and should remain executable.
- `tools/preflight-harness.sh` only runs temp-project integration when `tools/test-harness-integration.sh` is executable, so this silently weakens preflight.

Fix applied:

- `chmod +x apply.sh tools/test-harness-integration.sh`
- Reran `tools/test-harness-integration.sh`: passed.
- Reran `tools/preflight-harness.sh`: passed, including `== temp-project integration ==`.

### INFO - LOC result is real but below the original 30 percent target

Evidence:

- `git diff --shortstat`: `54 files changed, 366 insertions(+), 6404 deletions(-)`.
- Tracked text count: `73703 -> 67665`, reduction `6038`, `8.19%`.

Verifier note:

- The earlier destructive 30% approach was reverted. Reaching 30% now likely requires deleting real tests, lockfile content, app surface, or useful docs. Treat 8.19% as the current no-tradeoff reduction unless another agent finds a genuine no-tradeoff seam.

## Security Findings

### MEDIUM - gift recipient checkout leaks account registration by email

Files:

- `src/lib/payments/checkout.ts:77-90`
- `src/app/api/stripe-marketplace/checkout/primary/route.ts:14-49`
- `src/lib/api/errors.ts:32-41`

Evidence:

- Authenticated non-controller callers can submit `gift_recipient_email` to primary checkout.
- `resolveGiftRecipientUserId()` normalizes the email, queries `profiles.eq("email", normalizedEmail).maybeSingle()`, and throws `GiftRecipientNotFoundError(normalizedEmail)` if missing.
- `apiErrorResponse()` returns `DomainError.message` unchanged.

Impact:

- Any authenticated buyer/organizer can enumerate whether arbitrary email addresses have a MISO account by observing checkout error text.

Suggested fix:

- Return a generic gift-recipient error to clients and log/capture the raw email server-side only.
- Add a unit/API test asserting the response does not include the probed email.

Checked with no confirmed security finding:

- Admin API routes for attendees/retry deploy/retry mint.
- Controller gate APIs.
- Cron routes use `cronAuthError()`.
- Stripe marketplace webhook/refund paths, except the architecture refund sequencing issue below.
- Redeem/onboarding/resale checkout validation and auth.

## Architecture / Data / Payments Findings

### HIGH - manual refund reverses seller transfers before Stripe refund creation

File: `src/lib/stripe-marketplace/refunds.ts:66-86`

Evidence:

- `processManualRefund()` calls `proRateReversals(...)` at lines 66-71.
- It calls `stripe.refunds.create(...)` only afterward at lines 77-86.

Impact:

- If Stripe refund creation fails after successful transfer reversals, seller funds are clawed back while buyer is not refunded.

Suggested fix:

- Reorder or make the workflow compensating/idempotent so buyer refund creation cannot fail after irreversible seller reversal without recovery.
- Add a test where `stripe.refunds.create()` fails after reversal planning/execution and assert no inconsistent final state.

### MEDIUM - analytics per-event rows mix range-scoped revenue with lifetime counts

File: `src/lib/analytics/organization.ts:379-415`

Evidence:

- `revenueByEvent` is built from `scopedPurchases`, then range filtering happens earlier for totals/timeseries and revenue is meant to reflect the selected analytics range.
- `soldByEvent` uses category `sold_count` lifetime counters.
- `redeemedByEvent` counts all used tickets fetched for the event, not tickets redeemed in the selected range.

Impact:

- In a filtered date range, an event row can show range revenue but lifetime sold/redeemed/attendance numbers. This can mislead operators.

Verifier/product question:

- Decide whether per-event sold/redeemed are intentionally lifetime. If yes, rename/label the columns. If not, scope ticket counts by relevant timestamps and add range-sensitive tests.

### MEDIUM - event metadata can expose published events for inactive organizations

Files:

- `src/app/events/[id]/page.tsx:26-39`
- `src/lib/events/public.ts:109-121`

Evidence:

- Page body uses `getPublishedEventById()`, which filters out inactive organizations via `filterActiveOrganizationEvents()`.
- `generateMetadata()` uses local `getEventById()` and checks only `event.status === "published"`.

Impact:

- A published event belonging to an inactive/suspended/deleted organization can still emit title/description/OpenGraph/Twitter metadata even though the page body 404s.

Suggested fix:

- Reuse `getPublishedEventById()` in metadata or add the same active-organization gate.
- Add a test for metadata on a published event with inactive organization.

## UI / Accessibility Findings

Guideline source: Vercel Web Interface Guidelines, fetched from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.

### MEDIUM - no skip link before global header/navigation

File: `src/app/layout.tsx:101-105`

Evidence:

- Body renders `SmoothScroll`, `Header`, `main`, `Footer`, `BottomNav`, `Toaster` with no first-focusable skip link targeting main content.

Impact:

- Keyboard and screen-reader users must traverse global nav on every page.

Suggested fix:

- Add a visually-hidden/focus-visible `Skip to content` link before `Header` and give `<main>` a stable `id`.

### LOW - shared primitives use `transition-all`

Files:

- `src/components/ui/button.tsx:6-8`
- `src/components/ui/tabs.tsx:30-31`

Impact:

- `transition-all` can animate unintended layout/paint properties app-wide.

Suggested fix:

- Use explicit transitions such as `transition-colors`, `transition-transform`, or a targeted combination.

### LOW - storefront hero image has empty alt text

File: `src/app/s/[organizationSlug]/page.tsx:135-147`

Impact:

- When an organization provides a hero image, the primary storefront visual is hidden from assistive tech.

Suggested fix:

- Use descriptive alt text based on organization name/branding, or mark the whole media as decorative only if product confirms it is never meaningful.

### LOW - checkout dialog inputs missing semantic names/autocomplete

File: `src/components/site/buy-button.tsx:183-206`

Evidence:

- Gift email and promo code inputs have ids and controlled values but no `name` or `autoComplete`.

Suggested fix:

- Add `name="gift_recipient_email" autoComplete="email"` for gift email and `name="promo" autoComplete="off"` for promo.

### LOW - floor-plan image below fold does not lazy-load

File: `src/components/site/event-detail.tsx:120-131`

Suggested fix:

- Add `loading="lazy"` or use `next/image` with lazy behavior.

### LOW - copy control is icon-only without accessible label

File: `src/components/smartboard/custom-domain-settings.tsx:134-136`

Suggested fix:

- Add `aria-label`, e.g. `Copy DNS record value`.

### MEDIUM - assistant panel is custom dialog without modal/focus management

File: `src/components/ai/buyer-assistant-widget.tsx:68-91`

Evidence:

- Uses `role="dialog"` and `aria-label`, but no `aria-modal`, focus trap, initial focus, or restore-on-close behavior.

Suggested fix:

- Use the existing Radix dialog primitive or implement full modal semantics and focus management.

## Dependency / CI Findings

### LOW - dependency drift exists, but no high-severity audit vulnerabilities

Evidence:

- `npm audit --audit-level=high` passed with 0 vulnerabilities.
- `npm outdated --json` shows patch/minor updates available for packages including `@sentry/nextjs`, `@supabase/supabase-js`, `stripe`, `vitest`, `@playwright/test`, React 19 patch, and others. Major updates are available for Next 16, AI SDK 4/7, Tailwind 4, TypeScript 6, Zod 4, etc.

Suggested verifier action:

- Do not mix dependency upgrades into this LOC branch unless needed for a fix.
- Open a separate dependency-maintenance PR for wanted patch/minor bumps after this branch stabilizes.

### MEDIUM - recent GitHub CI history has failures

Evidence:

- `gh run list --limit 30 --json conclusion,workflowName,status,createdAt | jq ...` returned `18 CI` failures.

Suggested verifier action:

- Inspect whether those failures predate this branch or are still reproducible on current PR CI.

## Static Scan Notes

- Debug/TODO scan found expected console output in scripts/tests and no production `debugger`/TODO issue needing immediate action.
- Secret grep found fixture passwords only in e2e tests and a commented Supabase config example.
- PII log grep found script output of seeded emails and live-flow data only; no confirmed production logging leak from this scan.

## Suggested Verification Plan For Next Agent

1. Stage/add or inline all required untracked helper files. Confirm executable bits remain intact:
   - `test -x apply.sh`
   - `test -x tools/test-harness-integration.sh`
2. Rerun:
   - `git diff --check`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:unit`
   - `npm run build`
   - `tools/preflight-harness.sh`
   - `tools/test-harness-integration.sh`
   - `npm audit --audit-level=high`
3. Verify the three security/architecture issues with targeted tests or minimal repros.
4. Verify UI findings with keyboard/screen-reader smoke checks and a mobile viewport check after any fixes.
5. Re-run `git status --short --untracked-files=all`; no source dependency should remain untracked before commit.

## Important Non-Findings / False-Positive Guards

- Public calendar route is intentionally public and only returns published events.
- Signout route is intentionally callable without explicit user check; it signs out the current Supabase session if present.
- Cron routes use `cronAuthError()`.
- Admin retry and attendees routes check current profile plus event management rights.
- The active admin organization cookie is validated against admin memberships before use.
