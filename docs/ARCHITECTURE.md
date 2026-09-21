# Architecture

## High-Level Overview

```
User Wallet
    ↓
Next.js Frontend (App Router)
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│  Panta API      │  Meteora DBC     │  Conviction     │
│  (Markets)      │  (Launches)      │  Engine         │
└─────────────────┴──────────────────┴─────────────────┘
    ↓                   ↓
RPC Fast (all Solana reads/writes)
```

## Core Flow: Market ↔ Launch

1. User creates (or selects) a prediction market on Panta.
2. User creates a token launch and optionally links one or more market IDs.
3. PredictLaunch fetches market stats (volume, probability, traders).
4. Conviction Engine calculates a score (0–100).
5. Score determines unlocked benefits.
6. At launch, the score sets the pool's base trading fee (200 / 150 / 100 / 50 bps for Low / Medium / High / Very High) inside the Meteora DBC config (`lib/conviction/score.ts` -> `lib/meteora/client.ts`).

## Conviction Scoring (MVP)

| Signal              | Max Points | Notes                          |
|---------------------|------------|--------------------------------|
| Volume              | 40         | Thresholds at $200 / $1k / $5k |
| YES Probability     | 40         | Thresholds at 50% / 60% / 75%  |
| Number of Markets   | 20         | Bonus for 2+ linked markets    |

**Levels**
- 0–29 → Low
- 30–54 → Medium
- 55–74 → High
- 75–100 → Very High

## Data Storage (Current)

- Browser `localStorage` (`lib/conviction/store.ts`) for launch records (survives reloads, per-browser only)
- Replace with Postgres/Supabase or on-chain accounts to share launches between users

## RPC Strategy

The wallet `ConnectionProvider` and every helper resolve the endpoint through `lib/rpc/connection.ts` (`getRpcEndpoint()`), i.e. `NEXT_PUBLIC_RPC_ENDPOINT`. Tip: restrict that key by domain in the RPC Fast dashboard, since `NEXT_PUBLIC_` values ship to the browser. This satisfies the RPC Fast side track requirement.
