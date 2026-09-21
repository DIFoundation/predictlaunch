# Submission checklist

Hackathon window: **Sept 14 – Oct 12, 2026** (Colosseum Crypto World's Fair). Check the exact side-track deadlines on Superteam Earn.

## Where each sponsor shows up (be explicit in the submission text and video)
| Track | What the app does | Where a judge sees it |
|---|---|---|
| **Panta API** | Live markets + prices, normalised for Panta's real data quirks; conviction score from real volume/YES price; create-market flow (quote → confirm fee → sign → register); positions on the Portfolio page. "Powered by Panta" on market pages + footer. | `/markets`, `/markets/[id]`, `/create`, `/portfolio` |
| **Meteora DBC** | One-transaction config+pool creation via `buildCurveWithMarketCap`; **trading fee set by conviction** (2.0% → 0.5%); live pool reads (price, market cap, graduation progress); in-app buy/sell with re-quote + slippage. | `/launch`, `/launches`, `/launches/[mint]` |
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
