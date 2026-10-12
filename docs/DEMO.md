# Demo script (2–3 min)

## Preflight checklist (do this before recording)

- Run `pnpm lint` and `pnpm build`; fix all errors before recording.
- Start the app and open `/status`. Confirm the intended Solana network, RPC, and Panta status.
- Confirm the wallet is connected to the expected network. Mainnet actions spend real USDC and SOL.
- For a live market-creation demo, check the live quote first: Standard is published at 50 USDC and Breaking at 20 USDC. Make sure the wallet can cover the live quoted fee and has extra SOL for network fees. A 10 USDC budget will not cover either published market type.
- For a live buy demo, use an amount of at least 0.10 USDC and verify the wallet has enough USDC plus SOL. This minimum reflects the observed Panta on-chain rejection for smaller orders; the quote and simulation remain authoritative.
- Never record seed phrases, private keys, API keys, or personal wallet details. Do not bypass failed simulation or balance checks.
- If funds are insufficient, do a read-only demo of markets, market details, conviction, and portfolio. Do not pretend a transaction succeeded.

## Suggested recording (2–3 min)

1. **Hook (15s)** – "Token launches are pure speculation. PredictLaunch makes community conviction measurable."
2. **Markets (30s)** – `/markets`: live Panta markets → open one with volume → conviction panel + the fee it unlocks.
3. **Link (15s)** – "Launch a token linked to this market" (prefilled).
4. **Launch (45s)** – name/symbol → Launch on Meteora → simulate → approve → success.
5. **Trade (45s)** – "Open token page": live price/market cap/progress → Buy with SOL (quote, slippage, confirm) → balance updates → Sell some back.
6. **Portfolio (15s)** – SOL, token value, Panta positions — all live.
7. **Close (10s)** – RPC Fast mainnet infrastructure · Panta as proof of demand · Meteora DBC · built in Nigeria.
