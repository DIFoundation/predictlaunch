# Panta in-app trading

Source of truth: Panta's OpenAPI schema, `https://live-api.panta.market/api/schema/?format=json`
(found via `/api/panta/discover`). It lists every path and a one-line description, but **no request or
response bodies** for the trading/upload endpoints.

## Confirmed by the schema
| Action | Endpoint | Description in the schema |
|---|---|---|
| Buy quote | `POST /primaryorderquote/` | "Preview primary YES/NO buy fill; persist quoteId for primaryorderbuild." |
| Buy build | `POST /primaryorderbuild/` | "Build unsigned primary_order_usdc (+ optional ATA) from a quoteId." |
| Buy submit | `POST /primaryordersubmit/` | "Register broadcast signature; Celery finalizes." |
| Buy status | `POST /primaryorderverify/` | "Status only. Optional signature registers notify." |
| Claim | `POST /claim/build/` | "Build unsigned claim_win_usdc after on-chain claimable preflight." |
| Attribute | `POST /trades/` | "verify on-chain buy/claim and attribute AttributedTrade." |
| Attribution stats | `GET /account/metrics/`, `/account/trades/` | trades attributed to your API key |
| Positions | `GET /positions/?wallet=` | indexer holdings + registry + claimable policy |
| Live prices | `GET /markets/{id}/prices/` | live on-chain prices and volume |
| Trade history | `GET /markets/{market_id}/trades/` | "Balr trade history for a market" (used for the price-history chart) |
| Categories | `GET /categories/` | allowlist used for create + list filters |
| Create register | `POST /markets/register/` | (NOT `/markets/create/register/`) |
| Image upload | `POST /markets/create/image-upload/` | "Issue one scoped direct-upload signature; image bytes never hit this API." |

Only **primary-market** buys exist in the API. There is no secondary/order-book endpoint, so markets in the secondary
phase cannot be traded in-app.

## Not in the schema (guessed) and how each is made safe
| What's guessed | Where | How it's made safe |
|---|---|---|
| Trade request/response field names | `lib/panta/trade-spec.ts` | Before the wallet signs, the app **simulates the built transaction and measures how much USDC it really spends**, and refuses to sign if that exceeds what the user typed (`lib/panta/tx.ts`). Unit-tested, including a deliberate 5000-vs-5-USDC mismatch. |
| Trade-history (`/trades/`) field names | `lib/panta/trades.ts` | Parsed defensively across several common shapes; an unparseable response just means "no chart", never invented numbers. |
| Image-upload request/response shape | `lib/panta/upload-spec.ts` | Parsed defensively (presigned-POST or presigned-PUT); any failure at any step falls back to the existing manual "Image URL" field, never blocks market creation. |

## Finalise the guessed bodies (one step each)
1. Run the app in dev (`pnpm dev`) with your `pk_live_` key, open
   `http://localhost:3000/api/panta/probe?wallet=<your wallet>`.
2. It POSTs an empty body to each trading + upload endpoint (Panta replies 400 listing the required fields; nothing
   can be built, moved or uploaded) and samples the read endpoints, including `/markets/{id}/trades/` for a real
   market id. Send that JSON back, or edit `trade-spec.ts` / `upload-spec.ts` yourself.
3. Then do ONE small live buy (e.g. 1 USDC) on a primary-phase market, one image upload, and check `/status` ->
   "Panta attribution metrics" and "Panta trade history".

## Why this matters for the Panta track
`/trades/`, `/account/trades/` and `/admin/metrics/volumes/` describe **attributed** volume: trades routed through
your API key. Every in-app buy is submitted and attributed to your key automatically
(`app/api/panta/trade/submit/route.ts`). (This is inferred from the endpoint descriptions; confirm against the
track's judging criteria.)
