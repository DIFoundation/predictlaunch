# Current Project Status

**Live configuration:** mainnet, with a real `pk_live_` Panta key. **Legend:** ✅ verified here · 🧪 implemented + type-checked, needs a run against the real service · 🔴 not done

| Feature | Status | Notes |
|---|---|---|
| Network switch (mainnet/devnet/testnet) via `.env` | ✅ | Mainnet is the active network; devnet/testnet code paths are unchanged and still work. RPC/genesis mismatch blocks transactions; `/status` checks DBC is deployed on the chosen cluster |
| RPC relay (`/api/rpc`) | ✅ | Tested vs mock provider: relay, allowlist, cross-origin, batch/size limits, 403 handling; key never in client |
| `/status` diagnostics | ✅ | Pinpoints failing RPC call, network mismatch, gPA plan limits, Panta key/API, Panta attribution + trades endpoint reachability |
| Real data only | ✅ | Every market, price, pool and balance is live from Panta or the chain |
| Market list / detail / conviction | 🧪 | Verified vs mock Panta; needs a live-key run |
| Live prices merged onto markets | 🧪 | `/markets/{id}/prices/` overlaid on the catalog row; verified vs mock, needs a live run |
| Create Panta market | 🧪 | Mainnet only; register path corrected to `/markets/register/`; live category allowlist |
| Market image upload (beta) | 🧪 | `POST /markets/create/image-upload/`: endpoint confirmed, request/response shape guessed (`lib/panta/upload-spec.ts`); falls back to a manual image URL field on any failure |
| Meteora launch (config+pool, conviction fee) | 🧪 | Offline-built tx valid (1.1 KB); needs one live run |
| Token metadata image | ✅ | `/api/metadata` now returns an `image` field; `lib/meteora/metadataUri.ts` fits name/description/image into the ~200-char on-chain URI, dropping description then image if needed (unit-tested) |
| My Launches (live from chain, per wallet) | 🧪 | Uses `getProgramAccounts`; falls back to this browser's launches if blocked |
| **Explore (all launches, chain-wide)** | 🧪 | New: `/explore` lists every DBC pool on the network via the SDK's `getPools()`, not just the connected wallet's |
| Token page + buy/sell on the curve | 🧪 | Type-checked, helpers unit-tested; swap needs a live run |
| **Bonding-curve chart** | ✅ | Deterministic price-vs-SOL-raised shape computed from the pool's own config using the SDK's own delta-reserve math; unit-tested against two different curve configs; current position marked live |
| Portfolio (SOL, token balances, Panta positions) | 🧪 | Positions endpoint path confirmed by Panta's schema; needs a live-key run |
| **Portfolio holdings chart** | ✅ | Bar chart of token holdings by SOL value |
| Panta buy YES/NO in-app (primary market) | 🧪 | Endpoints confirmed from Panta's schema; request bodies guessed in `lib/panta/trade-spec.ts`; USDC spend verified by simulation before signing; needs one small live buy |
| Panta claim in-app | 🧪 | Same as above |
| **Market price-history chart** | 🧪 | `/markets/{id}/trades/` confirmed to exist (schema); response shape unknown, parsed defensively (`lib/panta/trades.ts`); shows "not enough history" if the shape can't be parsed, never fake data |
| Panta secondary (order-book) trading | 🔴 | No endpoint exists in Panta's API |
| Shared launch feed for ALL users | ✅ (superseded) | Previously listed as missing; `/explore` now provides this, chain-wide, not per-wallet |

## Known limitations
1. Every guessed request/response shape (Panta trade bodies, image-upload, trade-history fields) needs one real, small, live check — see `docs/PANTA_TRADING.md`.
2. Panta secondary-market (order-book) trades cannot be placed in-app; the API has no endpoint for it.
3. The bonding-curve chart shows the curve's real shape but not real trade-by-trade history (Meteora gives no historical price feed without an indexer); the market price-history chart is real history but depends on an unverified response shape.
