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
6. When real Meteora integration is complete, the score influences curve parameters at pool creation time.

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

- In-memory store (`src/lib/conviction/store.ts`) for launches
- Easily replaceable with Postgres, Redis, or on-chain accounts later

## RPC Strategy

All Solana `Connection` instances use the RPC Fast endpoint defined in `NEXT_PUBLIC_RPC_ENDPOINT`. This satisfies the RPC Fast side track requirement.
