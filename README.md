# Miso

On-chain ticketing app for event organizers, buyers, resale sellers, and
gate controllers.

Miso issues ERC-721 tickets on Base Sepolia through Thirdweb. In-app
checkout and resale payments go through Stripe Checkout Sessions;
NFT minting and transfers are triggered by the Stripe webhook.

## Stack

- Next.js 15 App Router
- Supabase auth, database, and migrations
- Stripe Checkout Sessions + webhook fulfillment
- Thirdweb Transactions API and Storage
- Base Sepolia ERC-721 event contracts
- Playwright e2e tests

## Local Setup

```bash
npm install
cp .env.example .env.local
supabase start
supabase migration up
npm run demo:seed
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=
THIRDWEB_API_URL=https://api.thirdweb.com
THIRDWEB_BACKEND_WALLET_ADDRESS=
CHAIN_ID=84532
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Use a restricted API key (`rk_` prefix) for `STRIPE_SECRET_KEY`.
For local webhook testing run `stripe listen --forward-to localhost:3002/api/stripe/webhook`.

Do not commit `.env.local` or provider secrets.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Live chain smoke tests are opt-in:

```bash
LIVE_CHAIN=true npm run test:e2e -- tests/e2e/live-chain.spec.ts
```

## Deploy

The app is Vercel-ready. Configure the environment variables above in
Vercel, then deploy the `development` branch or run:

```bash
npx vercel --prod
```
