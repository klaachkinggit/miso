# Legacy Checkout Decommission and Free-Ticket Claims

With multi-item primary checkout on marketplace rails (ADR 0002), nothing user-facing called the legacy Stripe Checkout-Session stack. This decommissions it and closes the one gap that kept it alive: zero-amount (free / RSVP) tickets.

## Decommission

Deleted: `/api/checkout`, `/api/marketplace/checkout`, `/api/stripe/webhook` (legacy handler) and `src/lib/payments/webhook.ts`; `createPurchaseCheckout` and its private helpers in `src/lib/payments/checkout.ts`; the Checkout-Session creators in `src/lib/payments/stripe.ts` (`createStripeCheckoutSession`, `createResaleStripeCheckoutSession`, `expireStripeCheckoutSession`); `checkoutResaleListing` plus its private fee/readiness helpers in `src/lib/resale/listing.ts`; `redirectToCheckout` (`src/lib/checkout/client.ts`, no callers); the legacy `session_id` branch of `/checkout/success`.

Kept (still consumed by the marketplace path): the pricing/normalization/gift helpers in `checkout.ts` (`checkoutPricing`, `normalizeQuantity`, `normalizeExtras`, `validateExtraGuests`, `resolveGiftRecipientUserId`), `src/lib/checkout/attribution.ts`, `src/lib/payments/pricing.ts`, and `getResaleCheckoutListing`. `fulfillResale` loses its `paymentMode` parameter and is now marketplace-only (the legacy `resale_seller_settlements` write is gone).

`provider_session_id` survives only as (a) a schema column, (b) the marketplace checkout idempotency key, and (c) one read in the admin ticket-refund subsystem (`src/lib/refunds/refund.ts`). Refund-stack consolidation is deliberately out of scope here and deferred; the legacy Stripe profile-mirror writes in `stripe-connect.ts` are likewise left in place because the `profiles.stripe_*` columns are still read by the onboarding fallback — removing them is part of the B2 seller-account migration, not the checkout decommission.

## Free-ticket claims

Organizers can create price-0 categories (the category schema allows `price >= 0`). The marketplace primary checkout previously rejected `category.price <= 0` outright — which also wrongly blocked club tables priced 0 that charge a non-zero online advance. Both are fixed by evaluating the **computed checkout amount** (`checkoutPricing` → `grossTotalCents`), not the raw category price:

- A club table priced 0 with an online advance settles on the normal paid PaymentIntent path (its real charge is the advance).
- A genuinely zero-amount checkout takes a **free-claim path**: reserve → record the purchase(s) → mint the ticket(s) → mark paid, synchronously, in the request. There is **no Stripe charge, no connected-account transfer, and no `marketplace_payments` row** — a marketplace payment models a charge + fee split, which is meaningless at amount 0. `createPrimaryCheckout` returns a discriminated `{ free: true, purchaseIds }` result; the card-checkout client skips Stripe and routes to `/tickets`.

Idempotent replay for free claims returns the already-minted purchases (matched on the idempotency key in `provider_session_id`) without re-reserving or re-minting. Fulfillment errors fall through to the existing reserve-release / fail-pending-purchase cleanup; already-minted items in a partial batch are left intact (the mint is idempotent).
