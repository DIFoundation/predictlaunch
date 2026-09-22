import { pantaServer } from "@/lib/panta/server";
import { normalizeMarket, overlayPrices } from "@/lib/panta/normalize";
import type { PantaMarket, PantaMarketRaw } from "@/types/panta";

/**
 * Load one market = catalog row + live on-chain prices (/prices/).
 * The catalog row alone often has null prices ("spot prices when RPC available"),
 * which made every market look priceless. If /prices/ fails we keep the catalog row.
 * Returns null when the market does not exist.
 */
export async function loadMarket(id: string): Promise<PantaMarket | null> {
  const [rowRes, pricesRes] = await Promise.allSettled([
    pantaServer.getMarket(id),
    pantaServer.getMarketPrices(id),
  ]);
  if (rowRes.status === "rejected") throw rowRes.reason;

  const raw = rowRes.value as PantaMarketRaw;
  if (!raw || !raw.marketId) return null;

  const merged = pricesRes.status === "fulfilled" ? overlayPrices(raw, pricesRes.value) : raw;
  return normalizeMarket(merged);
}
