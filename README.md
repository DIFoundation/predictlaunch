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
| RPC                | RPC Fast via a server-side relay (`/api/rpc`) |
| Charts              | recharts -- bonding curve, YES price history, portfolio holdings |
| State              | On-chain / Panta live data; localStorage only caches app metadata |

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
NEXT_PUBLIC_SOLANA_NETWORK=devnet        # mainnet | devnet | testnet (baked in at build time)
SOLANA_RPC_MAINNET=...                   # RPC Fast, server-side only
SOLANA_RPC_DEVNET=...                    # RPC Fast, server-side only
SOLANA_RPC_TESTNET=...                   # optional; DBC availability on testnet is checked at /status
PANTA_API_KEY=pk_live_...                # server-side only
PANTA_API_BASE_URL=https://live-api.panta.market/api/v1
```

Open `/status` after starting the app to verify the RPC, network and Panta connection.

This project currently runs on **mainnet** with a live Panta key. Devnet and testnet remain fully
supported by the same `NEXT_PUBLIC_SOLANA_NETWORK` switch -- see `.env.example`.

---

## Project Structure

```
app/                        # Next.js App Router pages + API routes
├── markets/                # Market list + detail (live Panta data)
├── launches/               # My launches (live from chain) + [mint] token page with buy/sell
├── portfolio/              # SOL, launched-token balances, Panta positions
├── status/                 # Diagnostics: RPC, network, Panta
├── create/                 # Create prediction market (quote -> confirm -> sign -> register)
├── launch/                 # Create token launch (conviction -> Meteora DBC)
└── api/                    # Server routes: Panta proxy (keeps API key private), token metadata
components/                 # Navbar, wallet provider, conviction panel
lib/
├── panta/                  # Panta server client + market normalizer
├── meteora/                # Meteora DBC config + transaction builder
├── rpc/                    # RPC Fast endpoint + cluster detection
└── conviction/             # Scoring + launch store
types/                      # Shared TypeScript types
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
