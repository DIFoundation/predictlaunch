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
  /** Human USDC, e.g. 5 = five dollars. Serialized as a 2-decimal string for Panta. */
  amountUsdc: number;
}

function optionalUserId() {
  const userId = process.env.PANTA_USER_ID?.trim();
  return userId ? { userId } : {};
}

export const TRADE_SPEC = {
  quote: (i: BuyInput) => ({
    wallet: i.wallet,
    marketId: i.marketId,
    side: i.side,
    amountUsdc: i.amountUsdc.toFixed(2),
    ...optionalUserId(),
  }),

  build: (i: { quoteId: string; wallet: string }) => ({
    quoteId: i.quoteId,
    wallet: i.wallet,
    ...optionalUserId(),
    maxSlippageBps: 100,
  }),

  submit: (i: { orderId: string; signature: string; wallet: string }) => ({
    orderId: i.orderId,
    signature: i.signature,
    wallet: i.wallet,
  }),

  verify: (i: { orderId: string; signature?: string }) => ({
    orderId: i.orderId,
    ...(i.signature ? { signature: i.signature } : {}),
  }),

  claim: (i: { wallet: string; marketId: string }) => ({
    wallet: i.wallet,
    marketId: i.marketId,
    ...optionalUserId(),
  }),

  attribute: (i: { signature: string; wallet?: string; marketId?: string }) => ({
    signature: i.signature,
    ...(i.wallet ? { wallet: i.wallet } : {}),
    ...(i.marketId ? { marketId: i.marketId } : {}),
  }),
};
