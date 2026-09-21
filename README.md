# PredictLaunch

**The launchpad where conviction is measurable.**

Communities create prediction markets about a token’s future milestones, success metrics, or related real-world events. High conviction and volume on those markets unlock better launch parameters, priority access, or marketing boosts on a Meteora Dynamic Bonding Curve. The prediction market is not the product — it is the proof of demand that powers better launches.

---

## Problem

Most token launches on Solana are pure speculation. There is almost no transparent, on-chain signal of real demand or community conviction before a token goes live.

## Solution

PredictLaunch turns community belief into a measurable signal.  
Prediction markets (Panta) act as proof of demand. When those markets show strong volume and conviction, the linked token launch on Meteora DBC receives better parameters and visibility.

---

## Key Features

- Create and browse prediction markets (Panta)
- Launch tokens on Meteora Dynamic Bonding Curve
- Link markets → launches to generate a **Conviction Score**
- Unlock benefits based on conviction level
- All Solana RPC traffic routed through **RPC Fast**
- Clean portfolio and discovery experience

---

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Frontend           | Next.js 16 (App Router), Tailwind CSS   |
| Wallet             | Solana Wallet Adapter                   |
| Prediction Markets | Panta API                               |
| Token Launches     | Meteora Dynamic Bonding Curve SDK       |
| RPC                | RPC Fast                                |
| State (MVP)        | In-memory store (easily replaceable)    |

---

## Getting Started

```bash
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```env
NEXT_PUBLIC_RPC_ENDPOINT=your_rpc_fast_https_endpoint
PANTA_API_KEY=your_panta_api_key
PANTA_API_BASE_URL=https://live-api.panta.market/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── markets/            # Market list + detail
│   ├── launches/           # Launch list
│   ├── create/             # Create prediction market
│   └── launch/             # Create token launch
├── components/
│   ├── layout/             # Navbar, etc.
│   └── wallet/             # Wallet provider
├── lib/
│   ├── panta/              # Panta API helpers
│   ├── meteora/            # Meteora DBC helpers
│   ├── rpc/                # RPC Fast connection
│   └── conviction/         # Market ↔ Launch logic + scoring
└── types/                  # Shared TypeScript types
```

---

## Hackathon Tracks

Submitted to Colosseum Crypto World’s Fair side tracks:

- Superteam Nigeria Track
- Panta API Side Track
- Best use of Meteora's Dynamic Bonding Curve (DBC)
- RPC Fast Infrastructure Sidetrack

---

## Team

Built in Nigeria for the Crypto World’s Fair.

---

## License

MIT
