import type { CreateQuoteInput } from "@/types/panta";

export const PANTA_BASE_URL =
  process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";

export class PantaError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
  }
}

/**
 * NOTE: Panta requires trailing slashes on every path ("/markets/", not "/markets").
 * All calls run server-side only so the API key never reaches the browser.
 */
export async function pantaFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.PANTA_API_KEY;
  if (!apiKey) {
    throw new PantaError("PANTA_API_KEY is not set (add it to .env.local / Vercel env vars)", 500);
  }

  const res = await fetch(`${PANTA_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      ...init.headers,
    },
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    // Surface Panta's real error body -- it names the exact invalid field.
    throw new PantaError(
      `Panta ${init.method || "GET"} ${path} failed (${res.status}): ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`,
      res.status,
      body
    );
  }
  return body as T;
}

const HOUR = 3600;

/** Fallback image. Panta refuses most public image hosts at *build* time, so
 *  set PANTA_DEFAULT_IMAGE_URL to a URL you have verified end-to-end. */
function defaultImageUrl(): string {
  return (
    process.env.PANTA_DEFAULT_IMAGE_URL ||
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
  );
}

export const pantaServer = {
  listMarkets(params?: { limit?: number; category?: string }) {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.category) q.set("category", params.category);
    const qs = q.toString();
    return pantaFetch(`/markets/${qs ? `?${qs}` : ""}`);
  },

  getMarket(marketId: string) {
    return pantaFetch(`/markets/${encodeURIComponent(marketId)}/`);
  },

  /** GET /positions/?wallet= -- indexer holdings + registry + claimable policy (confirmed in Panta's OpenAPI schema). */
  getPositions(wallet: string) {
    return pantaFetch(`/positions/?wallet=${encodeURIComponent(wallet)}`);
  },

  /** GET /categories/ -- the allowlist Panta enforces on create + list filters. */
  getCategories() {
    return pantaFetch("/categories/");
  },

  /** GET /markets/{id}/prices/ -- live on-chain prices and volume (the catalog row often has null prices). */
  getMarketPrices(marketId: string) {
    return pantaFetch(`/markets/${encodeURIComponent(marketId)}/prices/`);
  },

  // ---- Primary-market buy: quote -> build -> (user signs + broadcasts) -> submit -> verify ----
  primaryOrderQuote(body: unknown) {
    return pantaFetch("/primaryorderquote/", { method: "POST", body: JSON.stringify(body) });
  },
  primaryOrderBuild(body: unknown) {
    return pantaFetch("/primaryorderbuild/", { method: "POST", body: JSON.stringify(body) });
  },
  primaryOrderSubmit(body: unknown) {
    return pantaFetch("/primaryordersubmit/", { method: "POST", body: JSON.stringify(body) });
  },
  primaryOrderVerify(body: unknown) {
    return pantaFetch("/primaryorderverify/", { method: "POST", body: JSON.stringify(body) });
  },

  // ---- Claim winnings ----
  claimBuild(body: unknown) {
    return pantaFetch("/claim/build/", { method: "POST", body: JSON.stringify(body) });
  },

  // ---- Attribution: trades routed through this API key (what the Panta track measures) ----
  /** POST /trades/ -- verify an on-chain buy/claim and attribute it to this API key. */
  attributeTrade(body: unknown) {
    return pantaFetch("/trades/", { method: "POST", body: JSON.stringify(body) });
  },
  getAccountMetrics() {
    return pantaFetch("/account/metrics/");
  },
  getAccountTrades() {
    return pantaFetch("/account/trades/");
  },

  /** Step 1: quote. Response includes `createId` and the USDC fee (`paymentUsdc`). */
  quoteCreateMarket(input: CreateQuoteInput) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + HOUR + 300; // API requires >= now + 1h
    const endTime = startTime + 3 * 24 * HOUR;
    const resolutionTime = endTime + 2 * HOUR;

    return pantaFetch("/markets/create/quote/", {
      method: "POST",
      body: JSON.stringify({
        wallet: input.wallet,
        question: input.question,
        title: input.question.slice(0, 100),
        description: input.description || "Created via PredictLaunch",
        resolutionRule:
          "Resolved based on publicly available information from official sources and reputable media.",
        sourcesOfTruth: ["https://www.coingecko.com", "https://solscan.io"],
        category: input.category,
        startTime,
        endTime,
        resolutionTime,
        marketType: "standard",
        imageUrl: input.imageUrl || defaultImageUrl(),
        region: "Global",
      }),
    });
  },

  /** Step 2: build. Panta's build endpoint takes `createId` (was wrongly sent as `quoteId`). */
  buildCreateMarket(createId: string) {
    return pantaFetch("/markets/create/build/", {
      method: "POST",
      body: JSON.stringify({ createId }),
    });
  },

  /** Step 3: register the broadcast signature. Path is /markets/register/ (confirmed in Panta's OpenAPI schema). */
  registerMarket(payload: { createId: string; signature: string }) {
    return pantaFetch("/markets/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
