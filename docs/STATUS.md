# Current Project Status

**Legend:** ✅ verified here · 🧪 implemented + type-checked, needs a run against the real service · 🔴 not done

| Feature | Status | Notes |
|---|---|---|
| Network switch (mainnet/devnet/testnet) via `.env` | ✅ | Single var; RPC/genesis mismatch blocks transactions; `/status` checks DBC is deployed on the chosen cluster |
| RPC relay (`/api/rpc`) | ✅ | Tested vs mock provider: relay, allowlist, cross-origin, batch/size limits, 403 handling; key never in client |
| `/status` diagnostics | ✅ | Pinpoints failing RPC call, network mismatch, gPA plan limits, Panta key/API |
| Real data only | ✅ | Demo toggle + record-only launches removed; markets, conviction, pools, balances are live |
| Market list / detail / conviction | 🧪 | Verified vs mock Panta; needs your `pk_live_` key |
| Create Panta market | 🧪 | Mainnet only; register path corrected to `/markets/register/`; live category allowlist |
| Meteora launch (config+pool, conviction fee) | 🧪 | Offline-built tx valid (1.1 KB); needs one devnet run |
| My Launches (live from chain) | 🧪 | Uses `getProgramAccounts`; falls back to this browser's launches if blocked |
| Token page + buy/sell on the curve | 🧪 | Type-checked, helpers unit-tested; swap needs a devnet run |
| Portfolio (SOL, token balances, Panta positions) | 🧪 | Positions endpoint path is from the original client; unverified |
| Panta buy YES/NO in-app (primary market) | 🧪 | Endpoints confirmed from Panta's schema; request bodies guessed in `lib/panta/trade-spec.ts`; USDC spend verified by simulation before signing; needs one small live buy |
| Panta claim in-app | 🧪 | Same as above |
| Panta secondary (order-book) trading | 🔴 | No endpoint exists in Panta's API |
| Panta image upload for created markets | 🔴 | `/markets/create/image-upload/` response shape unknown |
| Shared launch feed for all users | 🔴 | Needs an indexer/tag account; "My Launches" is per wallet |
| Token image in metadata | 🔴 | On-chain URI is limited to 200 chars |
