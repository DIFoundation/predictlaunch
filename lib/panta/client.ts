const PANTA_BASE_URL = process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";
const API_KEY = process.env.NEXT_PUBLIC_PANTA_API_KEY || process.env.PANTA_API_KEY;

async function pantaFetch(path: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
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

export const panta = {
  async listMarkets(params?: { limit?: number; category?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.category) query.set("category", params.category);
    return pantaFetch(`/markets/?${query.toString()}`);
  },

  async getMarket(marketId: string) {
    return pantaFetch(`/markets/${marketId}/`);
  },

  async getPositions(wallet: string) {
    return pantaFetch(`/positions/?wallet=${wallet}`);
  },
};