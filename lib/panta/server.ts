const PANTA_BASE_URL = process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";
const API_KEY = process.env.PANTA_API_KEY;

async function pantaFetch(path: string, options: RequestInit = {}) {
  if (!API_KEY) {
    throw new Error("Panta API key is missing");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY,
    ...options.headers,
  };

  const res = await fetch(`${PANTA_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Panta API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

export const pantaServer = {
  async listMarkets(params?: { limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    return pantaFetch(`/markets/?${query.toString()}`);
  },

  async quoteCreateMarket(payload: any) {
    return pantaFetch("/markets/create/quote/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async buildCreateMarket(quoteId: string) {
    return pantaFetch("/markets/create/build/", {
      method: "POST",
      body: JSON.stringify({ quoteId }),
    });
  },

  async registerMarket(payload: { quoteId: string; signature: string }) {
    return pantaFetch("/markets/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
