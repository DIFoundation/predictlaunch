# Panta in-app trading

Source of truth: Panta's OpenAPI schema, `https://live-api.panta.market/api/schema/?format=json`
(found via `/api/panta/discover`). It lists every path and a one-line description, but **no request bodies**.

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
| Categories | `GET /categories/` | allowlist used for create + list filters |
| Create register | `POST /markets/register/` | (NOT `/markets/create/register/`) |
| Image upload | `POST /markets/create/image-upload/` | direct-upload signature; not wired yet |

Only **primary-market** buys exist in the API. There is no secondary/order-book endpoint, so markets in the secondary phase
cannot be traded in-app.

## Not in the schema (guessed) and how it is made safe
Field names/values of the request bodies live in **one file: `lib/panta/trade-spec.ts`**. If Panta rejects one, the app shows its
validation message verbatim.

Money safety does not rely on those guesses: before the wallet is asked to sign, the app **simulates the built transaction and measures
how much USDC it really spends** (`lib/panta/tx.ts`). It refuses to sign if that exceeds what the user typed (plus a small tolerance),
and asks for extra confirmation if the spend can't be determined.

## Finalise the bodies (one step)
1. Run the app in dev (`pnpm dev`) with your `pk_live_` key, open
   `http://localhost:3000/api/panta/probe?wallet=<your wallet>`.
2. It POSTs an empty body to each trading endpoint (Panta replies 400 listing the required fields; nothing can be built or moved) and
   samples the read endpoints. Send that JSON back, or edit `trade-spec.ts` yourself.
3. Then do ONE small live buy (e.g. 1 USDC) on a primary-phase market and check `/status` -> "Panta attribution metrics".

## Why this matters for the Panta track
`/trades/`, `/account/trades/` and `/admin/metrics/volumes/` describe **attributed** volume: trades routed through your API key.
Every in-app buy is submitted and attributed to your key automatically (`app/api/panta/trade/submit/route.ts`).
(This is inferred from the endpoint descriptions; confirm against the track's judging criteria.)
