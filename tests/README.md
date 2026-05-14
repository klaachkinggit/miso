# Tests

Three layers, all under `tests/e2e/` (Playwright is the only runner).

## Smoke (`smoke.spec.ts`)

Always-on shallow checks: pages render, auth-gated routes redirect.
No DB seed required. Runs in CI on every push.

```
npm run test:e2e
```

## Full path (`full-path.spec.ts`)

Authenticated journeys (login → buy → tickets → redeem, resale list +
checkout). Requires a seeded Supabase. Gated behind `MISO_E2E_FULL=1`
so CI without a seeded DB stays green on smoke alone.

```
supabase start
supabase migration up
npm run demo:seed
MISO_E2E_FULL=1 npm run test:e2e
```

## Live Base Sepolia (`live-chain.spec.ts`)

End-to-end on-chain smoke that hits the real Thirdweb Transactions API
on Base Sepolia (chain 84532). Deploys a fresh MisoTicket contract,
mints to a pregenerated In-App Wallet, then reads `ownerOf` and
`tokenURI` back over RPC. Off by default — burns Sepolia ETH from the
backend wallet (free, but rate-limited by the faucet).

```
LIVE_CHAIN=true \
THIRDWEB_CLIENT_ID=... \
THIRDWEB_SECRET_KEY=... \
THIRDWEB_BACKEND_WALLET_ADDRESS=0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5 \
CHAIN_ID=84532 \
npx playwright test tests/e2e/live-chain.spec.ts
```

The backend wallet must hold Sepolia ETH (≈0.05 ETH covers many runs).
Faucet: https://www.alchemy.com/faucets/base-sepolia.

## Why no unit-test runner?

The on-chain plan called for msw-mocked unit tests around the Thirdweb
client. The repo only ships Playwright today; adding vitest/jest just
for three clients was scoped out. Coverage is satisfied by the live
smoke test plus the full-path e2e once seeded. Revisit if the
on-chain surface area grows.
