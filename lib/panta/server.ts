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

/** Retry once only for Panta's opaque INVALID_MARKET_PARAMS internal failures. */
async function pantaFetchRetryOpaque<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await pantaFetch<T>(path, init);
  } catch (error) {
    if (!(error instanceof PantaError) || error.status !== 400) throw error;
    const body = error.body as { code?: unknown; message?: unknown } | null;
    const code = body && typeof body === "object" ? body.code : undefined;
    const message = body && typeof body === "object" && typeof body.message === "string" ? body.message : "";
    const opaque = code === "INVALID_MARKET_PARAMS" && (!message || /unexpected .*failure|check server logs/i.test(message));
    if (!opaque) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return pantaFetch<T>(path, init);
  }
}

/** Fallback image. Panta refuses most public image hosts at *build* time, so
 *  set PANTA_DEFAULT_IMAGE_URL to a URL you have verified end-to-end. */
function defaultImageUrl(): string {
  return (
    process.env.PANTA_DEFAULT_IMAGE_URL ||
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
  );
}

export const pantaServer = {
  listMarkets(params?: { limit?: number; category?: string; status?: "active" | "inactive" | "all" }) {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.category) q.set("category", params.category);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return pantaFetch(`/markets/${qs ? `?${qs}` : ""}`);
  },

  /**
   * Prefer filtering at Panta before downloading the catalog. If this API version
   * rejects the status parameter, fall back to the ordinary list and let the
   * caller apply the same lifecycle filter locally.
   */
  async listActiveMarkets(params?: { limit?: number; category?: string }) {
    try {
      return await this.listMarkets({ ...params, status: "active" });
    } catch (error) {
      if (error instanceof PantaError && (error.status === 400 || error.status === 422)) {
        return this.listMarkets(params);
      }
      throw error;
    }
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

  /** POST /markets/create/image-upload/ -- issue a direct-upload signature (see lib/panta/upload-spec.ts). */
  createImageUpload(body: unknown) {
    return pantaFetch("/markets/create/image-upload/", { method: "POST", body: JSON.stringify(body) });
  },

  /** GET /markets/{id}/prices/ -- live on-chain prices and volume (the catalog row often has null prices). */
  getMarketPrices(marketId: string) {
    return pantaFetch(`/markets/${encodeURIComponent(marketId)}/prices/`);
  },

  /** GET /markets/{id}/trades/ -- "Balr trade history for a market" (confirmed path, response shape not documented). */
  getMarketTrades(marketId: string) {
    return pantaFetch(`/markets/${encodeURIComponent(marketId)}/trades/`);
  },

  // ---- Primary-market buy: quote -> build -> (user signs + broadcasts) -> submit -> verify ----
  primaryOrderQuote(body: unknown) {
    return pantaFetchRetryOpaque("/primaryorderquote/", { method: "POST", body: JSON.stringify(body) });
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
    // Panta's current rules require Standard-market events to start at least 72h ahead.
    // Defaults are used only when no schedule is supplied; creators may choose valid times.
    const startTime = input.startTime ?? now + 3 * 24 * HOUR + 300;
    const endTime = input.endTime ?? startTime + 3 * 24 * HOUR;
    if (!Number.isSafeInteger(startTime) || startTime < now + 72 * HOUR + 300) {
      throw new PantaError("Market start time must be at least 72 hours and 5 minutes in the future.", 400);
    }
    if (!Number.isSafeInteger(endTime) || endTime <= startTime) {
      throw new PantaError("Market close time must be later than its start time.", 400);
    }
    const resolutionTime = endTime + 2 * HOUR;

    return pantaFetchRetryOpaque("/markets/create/quote/", {
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
    return pantaFetchRetryOpaque("/markets/create/build/", {
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
