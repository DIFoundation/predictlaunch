/**
 * THE ONLY FILE THAT ENCODES GUESSES ABOUT PANTA'S TRADING REQUEST BODIES.
 *
 * What is CONFIRMED (Panta OpenAPI schema, descriptions on each path):
 *   POST /primaryorderquote/   "Preview primary YES/NO buy fill; persist quoteId for primaryorderbuild."
 *   POST /primaryorderbuild/   "Build unsigned primary_order_usdc (+ optional ATA) from a quoteId."
 *   POST /primaryordersubmit/  "Register broadcast signature; Celery finalizes."
 *   POST /primaryorderverify/  "Status only. Optional signature registers notify."
 *   POST /claim/build/         "Build unsigned claim_win_usdc after on-chain claimable preflight."
 *   POST /trades/              "verify on-chain buy/claim and attribute AttributedTrade."
 *
 * What is NOT in the schema (it lists no request bodies) and is therefore a GUESS:
 *   the exact field names / value formats below. If Panta answers 400, the app shows its
 *   validation message verbatim; run /api/panta/probe (dev) to list the required fields, then
 *   adjust ONLY this file.
 *
 * Money safety does not depend on these guesses: before the wallet is asked to sign, the client
 * simulates the built transaction and checks how much USDC it will really spend
 * (see lib/panta/tx.ts -> simulateUsdcSpend).
 */

export type Side = "yes" | "no";

export interface BuyInput {
  wallet: string;
  marketId: string;
  side: Side;
  /** Human USDC, e.g. 5 = five dollars. (Create-quote returns `paymentUsdc: 50` in this same unit.) */
  amountUsdc: number;
}

export const TRADE_SPEC = {
  // GUESS: field names + lowercase side. `marketId` / `wallet` match the rest of Panta's API.
  quote: (i: BuyInput) => ({
    wallet: i.wallet,
    marketId: i.marketId,
    side: i.side,
    amountUsdc: i.amountUsdc,
  }),

  // Documented: built "from a quoteId". `wallet` is sent too in case the server binds it.
  build: (i: { quoteId: string; wallet: string }) => ({
    quoteId: i.quoteId,
    wallet: i.wallet,
  }),

  // GUESS: quoteId + signature.
  submit: (i: { quoteId: string; signature: string; wallet: string }) => ({
    quoteId: i.quoteId,
    signature: i.signature,
    wallet: i.wallet,
  }),

  verify: (i: { quoteId?: string; signature?: string }) => ({
    ...(i.quoteId ? { quoteId: i.quoteId } : {}),
    ...(i.signature ? { signature: i.signature } : {}),
  }),

  // GUESS: wallet + marketId.
  claim: (i: { wallet: string; marketId: string }) => ({
    wallet: i.wallet,
    marketId: i.marketId,
  }),

  // GUESS: signature (the server "verifies on-chain buy/claim" from it).
  attribute: (i: { signature: string; wallet?: string; marketId?: string }) => ({
    signature: i.signature,
    ...(i.wallet ? { wallet: i.wallet } : {}),
    ...(i.marketId ? { marketId: i.marketId } : {}),
  }),
};
