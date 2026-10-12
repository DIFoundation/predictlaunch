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
- Solana RPC traffic uses the same server-side relay; **RPC Fast is the mainnet provider**
- Clean portfolio and discovery experience

---

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Frontend           | Next.js 16 (App Router), Tailwind CSS   |
| Wallet             | Solana Wallet Adapter                   |
| Prediction Markets | Panta API                               |
| Token Launches     | Meteora Dynamic Bonding Curve SDK       |
| RPC                | Server-side `/api/rpc` relay; RPC Fast on mainnet |
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
SOLANA_RPC_MAINNET=...                   # RPC Fast Mainnet endpoint, server-side only
SOLANA_RPC_DEVNET=...                    # Devnet RPC, server-side only (public default is supported)
SOLANA_RPC_TESTNET=...                   # optional; DBC availability on testnet is checked at /status
PANTA_API_KEY=pk_live_...                # server-side only
PANTA_API_BASE_URL=https://live-api.panta.market/api/v1
```

Open `/status` after starting the app to verify the RPC, network and Panta connection.

The active Solana network is controlled by **one switch**: `NEXT_PUBLIC_SOLANA_NETWORK`.
Set it to `devnet` for testing or `mainnet` for production. The app automatically selects the
matching server-side RPC URL; no source-code changes are required when switching networks.

---

## Panta market creation and buying

Market creation uses Panta's live quote as the source of truth for the creation fee. PredictLaunch supports two market types:

- **Standard** — published creation fee: 50 USDC; the event must start at least 72 hours and 5 minutes in the future.
- **Breaking** — published creation fee: 20 USDC; the event must start within the next 72 hours or may already be underway.

These are published fee levels, not user-configurable prices. The app checks the live quote against the creator's maximum budget and checks the connected wallet's USDC balance before transaction building/signing. A budget below the live quote is rejected before a transaction is built. SOL is also needed for Solana network fees.

Primary-market buys must be at least **0.10 USDC** (minimum inferred from Panta's on-chain `OrderTooSmall` rejection). The UI and quote API reject smaller amounts, and the buy flow checks the available USDC balance before proceeding. The wallet still needs enough SOL for network fees, and transaction simulation must pass before signing.

**Demo safety:** creating a market or buying shares can spend real mainnet USDC. Use a wallet with only the intended demo funds, confirm the network and token mint, and never bypass balance checks or transaction simulation. If you do not have sufficient USDC, demonstrate existing markets, market details, conviction indicators, and the portfolio read-only views instead.

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
├── rpc/                    # Network-aware RPC relay + cluster detection
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
