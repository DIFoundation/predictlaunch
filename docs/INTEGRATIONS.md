# Integrations Notes

## 1. RPC Fast
- **Network switch:** `NEXT_PUBLIC_SOLANA_NETWORK=mainnet|devnet`; endpoints `SOLANA_RPC_MAINNET` / `SOLANA_RPC_DEVNET` (server-side).
- **Relay:** browsers call `/api/rpc` (`app/api/rpc/route.ts`), which forwards to RPC Fast. Benefits: the key is never shipped to
  the client, no origin/CORS/domain-allowlist 403s, and every read/write still goes through RPC Fast. The relay is same-origin only,
  method-allowlisted, size/batch-limited and rate-limited.
- **No WebSockets:** confirmation polls `getSignatureStatuses` (`confirmSignature` in `lib/rpc/connection.ts`).
- **Safety:** `NetworkProvider` reads the genesis hash and blocks transactions if the RPC is on a different cluster than the app setting.
- **Debugging a 403:** open `/status`. Common causes: bad/inactive key, key restricted to certain origins/IPs, or a plan that blocks
  `getProgramAccounts` (needed to list launches; the app falls back to launches made from this browser).

## 2. Panta API (prediction markets)
**Base URL:** `https://live-api.panta.market/api/v1` · **Auth:** `X-Api-Key` header, server-side only
(`lib/panta/server.ts`; browser code calls our `/api/panta/*` routes).

**Gotchas that cost real debugging time**
- **Trailing slashes are required** (`/markets/`, not `/markets`).
- `pk_test_` keys return sandbox fixtures; use `pk_live_` for real data.
- Market `title` is often empty (the question lives in `description`) and prices are often `null`.
  `lib/panta/normalize.ts` handles both; `null` price = "no live price", never 0%.
- Timestamps are unix seconds live but ISO strings in sandbox (normalizer handles both).
- `imageUrl` is soft-checked at *quote* and hard-checked at *build*. Many public hosts pass quote and then fail
  build with an opaque error. Set `PANTA_DEFAULT_IMAGE_URL` to a URL you have verified end-to-end.
- Creating a market spends real USDC (platform fee + liquidity). The create page shows Panta's quoted fee and
  requires confirmation before anything is built or signed.
- Panta API Terms require the visible attribution **"Powered by Panta"** (present in the footer and on market pages).

| Action | Method + path | Status |
|---|---|---|
| List markets | `GET /markets/` | wired (`/markets`) |
| Get market | `GET /markets/{id}/` | wired (market page + conviction on `/launch`) |
| Create: quote | `POST /markets/create/quote/` | wired; needs a live key to verify |
| Create: build | `POST /markets/create/build/` body `{ createId }` | wired (was wrongly sent as `quoteId`) |
| Create: register | `POST /markets/create/register/` body `{ createId, signature }` | wired (path was `/markets/register/`); **body shape unverified** |
| Buy YES/NO | orders endpoints | not implemented |

## 3. Meteora Dynamic Bonding Curve
- `lib/meteora/client.ts` builds a full config with the SDK's `buildCurveWithMarketCap` and submits
  `partner.createConfigAndPool` as **one** transaction (~1.1 KB, under the 1,232-byte limit).
- Liquidity percentages must sum to 100 (partner-permanent-locked = 100 here).
- **Conviction lever:** `feeBpsForScore()` sets the constant base fee (Low 200 / Medium 150 / High 100 / Very High 50 bps; SDK minimum is 25).
- **Trading:** `lib/meteora/pools.ts` reads pools/config from the chain and builds `swap2` transactions (buy = SOL→token, sell = token→SOL); it re-quotes right before signing and aborts if the price moved past the user's slippage.
- Pools launched from this app are read by direct address (plain `getAccountInfo`); other tokens are found by base mint (`getProgramAccounts`).
- Safety: the tx is simulated on the RPC before the wallet is asked to sign; mainnet requires an explicit confirm.
- Token metadata URI points to `/api/metadata` (needs a publicly reachable `NEXT_PUBLIC_APP_URL` for wallets to fetch it; no image yet).
