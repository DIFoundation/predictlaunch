# Panta in-app trading — what's missing

Everything Panta-related that is verified works in-app (browse, live prices, create market, positions on the
Portfolio page). **Buying / selling YES–NO shares and claiming winnings are not wired**, because the buy / sell /
claim endpoint paths and request bodies are not in the docs we had access to, and we do not guess a live
money-moving API.

## To finish it
1. In dev, run the app and open `http://localhost:3000/api/panta/discover`. It looks for Panta's OpenAPI schema
   and lists every buy / sell / order / position / claim path with its methods.
2. If it finds nothing, copy the "primary buy", "secondary order", "claim" sections from Panta's API docs.
3. Send those to the developer. Wiring is small because the custody model is the same as market creation
   (`quote -> build -> user signs -> broadcast -> register receipt`): reuse `sendAndConfirm` from
   `lib/rpc/connection.ts` and copy the pattern in `app/create/page.tsx`.

Note: Panta's transactions are mainnet, so trading is mainnet-only (`NEXT_PUBLIC_SOLANA_NETWORK=mainnet`).
