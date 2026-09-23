# Submission checklist

Hackathon window: **Sept 14 – Oct 12, 2026** (Colosseum Crypto World's Fair). Check the exact side-track deadlines on Superteam Earn.

## Where each sponsor shows up (be explicit in the submission text and video)
| Track | What the app does | Where a judge sees it |
|---|---|---|
| **Panta API** | Live markets + on-chain prices + real trade-history chart; conviction score from real volume/YES price; **in-app buy (primary-order flow) with on-chain USDC verification; claim winnings; trades attributed to our API key**; create-market flow with live category list + beta image upload; positions. "Powered by Panta" on market pages + footer. | `/markets/[id]` (chart + trade panel), `/portfolio`, `/create`, `/status` (attribution metrics) |
| **Meteora DBC** | One-transaction config+pool creation via `buildCurveWithMarketCap`; **trading fee set by conviction** (2.0% → 0.5%); live pool reads (price, market cap, graduation progress); in-app buy/sell with re-quote + slippage; **a real bonding-curve chart computed from the pool's own config**; **a chain-wide Explore feed of every launch**, not just one wallet's; token image in on-chain metadata. | `/launch`, `/launches`, `/launches/[mint]`, `/explore` |
| **RPC Fast** | Every Solana read/write goes through an RPC Fast-backed server relay; `/status` proves connectivity, cluster and method support. | `/status`, footer |
| **Superteam Nigeria** | TODO: decide the local angle (see below) | — |

## Must-do before submitting
- [ ] One real **devnet** launch + buy + sell, screenshots of the tx links
- [ ] One real **mainnet** launch if you want "working on mainnet" credibility (small, and only on a public https deploy)
- [ ] `/status` all green on the deployed site
- [ ] Deployed to Vercel with env vars set **before** the build (`NEXT_PUBLIC_SOLANA_NETWORK` is baked in at build time)
- [ ] 2–3 min demo video (script: `docs/DEMO.md`)
- [ ] README: live URL, video link, and the table above
- [ ] Panta in-app trading (see `docs/PANTA_TRADING.md`) if the Panta track expects buy/claim
- [ ] Paste each track's exact criteria here and tick them off: ______

## Matching multiple tracks
Open each track's page on https://superteam.fun/earn/hackathon/crypto-worlds-fair, copy its **description + judging criteria**, and paste it below.
Then tick each item against the app. A project can usually be submitted to several side tracks, but check each track's rules
(e.g. whether the same project may enter more than one, and whether it needs a separate submission).

### Panta API track
(paste criteria)

### Meteora DBC track
(paste criteria)

### RPC Fast track
(paste criteria)

### Superteam Nigeria track
(paste criteria)
