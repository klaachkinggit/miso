# Tests

Test process now has five layers. Goal: every new pure module gets unit
coverage, every API/service boundary gets integration or e2e coverage,
every DB invariant gets a migration/e2e assertion, and every chain path
gets mock coverage plus one live Base Sepolia smoke.

## Unit: isolated modules

Pure, no DB, no Stripe, no Thirdweb. Covers V2 pricing, wallet export
policy, and request schemas.

```
npm run test:unit
```

## Static checks

```
npm run typecheck
npm run lint
npm run build
```

## Smoke e2e

Always-on shallow checks: pages render, auth-gated routes redirect.
No DB seed required.

```
npm run test:e2e
```

## Full local e2e + invariants

Authenticated journeys and DB-level invariants. Uses `MISO_MOCK_CHAIN=1`
to verify UI/database behavior without broadcasting Thirdweb txs.

```
supabase start
supabase db reset
npm run supabase:types
npm run demo:seed
npm run test:e2e:all-local
```

Covers checkout, wallet, redemption, resale, role gates, controller
flows, authz, reservation races, chain-op constraints, V2 gift guard,
wallet export authz, and marketplace fee persistence.

## Live Base Sepolia

Real Thirdweb Transactions API on Base Sepolia (`84532`). Deploys fresh
MisoTicket, mints to a pregenerated In-App Wallet, then reads `ownerOf`
and `tokenURI` over RPC. Off by default because it needs funded backend
wallet and live API credentials.

```
LIVE_CHAIN=true \
THIRDWEB_SECRET_KEY=... \
THIRDWEB_BACKEND_SMART_WALLET_ADDRESS=0x... \
CHAIN_ID=84532 \
npx playwright test tests/e2e/live-chain.spec.ts
```

## Release gate

Run this before merging feature branches:

```
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run test:e2e:all-local
LIVE_CHAIN=true npx playwright test tests/e2e/live-chain.spec.ts
```

No suite can prove literally every UI state forever. Rule: new module or
regression gets smallest isolated test first, then one end-to-end path if
behavior crosses UI/API/DB/chain.
