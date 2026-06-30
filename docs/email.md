# Transactional Email (Resend + react-email)

Miso sends transactional email through [Resend](https://resend.com) with
templates authored as [react-email](https://react.email) components. Email is
a **best-effort side channel**: it never blocks or alters payments,
settlement, refunds, seller onboarding, or event publishing. Every send path
is fully internally caught and is a complete no-op when email is not
configured.

## Configuration

| Env var          | Required        | Purpose                                                                                      |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | to enable email | Resend API key. **Unset → email is a no-op** (Resend is never constructed, no network call). |
| `EMAIL_FROM`     | to enable email | Verified sender, e.g. `Miso <tickets@miso.example>`. **Unset → email is a no-op.**           |
| `EMAIL_REPLY_TO` | optional        | Reply-To address for replies from recipients.                                                |

Local and CI have neither `RESEND_API_KEY` nor `EMAIL_FROM`, so the whole
layer is inert there — `lint` / `typecheck` / `vitest` / `build` stay green
without any email infrastructure.

The fail-safety contract:

- `getResend()` returns `null` unless `RESEND_API_KEY` is set.
- `sendTransactionalEmail()` returns `{ sent: false }` immediately if either
  `RESEND_API_KEY` or `EMAIL_FROM` is unset; otherwise it renders + sends,
  wrapped in `try/catch` that logs via `console.error("[email] …", err)` and
  never throws.
- Every `send*` helper in `src/lib/email/send.ts` short-circuits **before any
  DB lookup** when email is unconfigured, and is itself fully `try/catch`ed —
  it never throws and never rejects. A missing recipient email is a no-op.

## Resend setup

1. Create a Resend account and add your sending **domain** (not a shared
   `onboarding@resend.dev` address) in the Resend dashboard → Domains.
2. Create an API key (Resend → API Keys) and set it as `RESEND_API_KEY` in the
   deployment environment.
3. Set `EMAIL_FROM` to an address **on the verified domain**, e.g.
   `Miso <tickets@miso.example>`. The domain in `EMAIL_FROM` MUST be the
   domain you authenticated below — Resend rejects sends from unverified
   domains.

### EMAIL_FROM domain requirement

The address in `EMAIL_FROM` must use a domain that is **verified in Resend**
and passes domain authentication. Sending from an unauthenticated domain will
fail at the Resend API (the error is logged and swallowed — no email is sent,
nothing else breaks).

## Domain authentication (SPF / DKIM / DMARC)

Resend shows the exact DNS records to add when you register a domain. The
records fall into three standards:

1. **SPF** — add the TXT record Resend provides (an `include:` for Resend's
   sending hosts), e.g.:

   ```
   miso.example.  TXT  "v=spf1 include:amazonses.com ~all"
   ```

   If you already have an SPF record, merge the `include` into the existing
   one — a domain may have only one SPF TXT record.

2. **DKIM** — add the CNAME (or TXT) records Resend lists. These publish the
   public keys Resend uses to sign outgoing mail, e.g.:

   ```
   resend._domainkey.miso.example.  CNAME  <value-from-resend>
   ```

3. **DMARC** — add a DMARC policy so receivers know how to treat mail that
   fails SPF/DKIM, e.g.:
   ```
   _dmarc.miso.example.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@miso.example"
   ```
   Start with `p=none` (monitor only), then tighten to `p=quarantine` and
   eventually `p=reject` once SPF + DKIM are confirmed aligned.

After adding the records, click **Verify** in the Resend dashboard. DNS
propagation can take minutes to hours.

## Transactional emails and their triggers

| Template (`src/lib/email/templates/`) | Recipient                         | Trigger site                                                                                           | When                                                                                                             |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `PurchaseReceipt`                     | Buyer                             | `src/lib/stripe-marketplace/fulfillment.ts` → `settleSucceededPaymentIntent` (kind `primary`)          | After the payment reaches `PAID`. Doubles as ticket delivery — tickets live in the buyer's wallet at `/tickets`. |
| `ResaleBoughtNotice`                  | Buyer                             | `src/lib/stripe-marketplace/fulfillment.ts` → `settleSucceededPaymentIntent` (kind `resale`)           | After `PAID`. Resale purchase confirmed; link to `/tickets`.                                                     |
| `ResaleSoldNotice`                    | Seller (`primary_seller_user_id`) | `src/lib/stripe-marketplace/fulfillment.ts` → `settleSucceededPaymentIntent` (kind `resale`)           | After `PAID`. Seller's listed ticket sold; payout note.                                                          |
| `RefundNotice`                        | Buyer                             | `src/lib/stripe-marketplace/refunds.ts` → `manuallyRefundPayment` **and** `recordExternalChargeRefund` | After the refund is recorded.                                                                                    |
| `PayoutReady`                         | Seller / organizer                | `src/lib/stripe-marketplace/seller-accounts.ts` → `syncSellerAccountFromStripe`                        | Only on the `charges_enabled` false→true transition (newly able to charge), not on every sync.                   |
| `EventPublished`                      | Organizer (`organizer_user_id`)   | `src/lib/events/setup.ts` → `publishEventSetup`                                                        | After the event status flips to `published`; links to the `/events/{slug}` storefront.                           |

## How sends stay isolated from settlement

At each trigger the send is performed **after** the business outcome is
committed (e.g. after `transitionPayment(…, { type: "PAID" })`, after the
refund audit row, after `status: "published"`). The send helpers are
`await`ed — safe on serverless because they never throw and never reject — so
they cannot change any control flow, return value, or error of the payment /
settlement / refund / publish path. Display-data lookups that the send
helpers don't own (event name, category) are additionally wrapped in their own
`try/catch` at the trigger so a lookup failure cannot escape.
