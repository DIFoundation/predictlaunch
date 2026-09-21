import type { PantaMarket, PantaMarketRaw } from "@/types/panta";

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Unix seconds live, ISO string in sandbox -> always unix seconds. */
function toUnixSeconds(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return v;
  const asNum = Number(v);
  if (Number.isFinite(asNum)) return asNum;
  const ms = Date.parse(String(v));
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function toProbability(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  // Tolerate both 0..1 and 0..100 encodings.
  const p = n > 1 ? n / 100 : n;
  return p >= 0 && p <= 1 ? p : null;
}

export function normalizeMarket(raw: PantaMarketRaw): PantaMarket {
  const title = raw.title?.trim() || "";
  const description = raw.description?.trim() || "";

  let displayTitle = title;
  let textQuality: PantaMarket["textQuality"] = "full";
  if (!title && description) {
    displayTitle = description.length > 140 ? `${description.slice(0, 137)}...` : description;
    textQuality = "description-only";
  } else if (!title) {
    displayTitle = `Market ${raw.marketId.slice(0, 8)}...`;
    textQuality = "none";
  }

  const yes =
    toProbability(raw.yesPrice) ??
    toProbability(raw.secondaryYesPrice) ??
    toProbability(raw.primaryYesPrice);
  const no =
    toProbability(raw.noPrice) ??
    toProbability(raw.secondaryNoPrice) ??
    toProbability(raw.primaryNoPrice);

  return {
    marketId: raw.marketId,
    title: displayTitle,
    textQuality,
    description: description || undefined,
    category: raw.category || "general",
    phase: String(raw.phase ?? raw.status ?? "unknown"),
    volumeUsdc: toNumber(raw.volumeUsdc) ?? 0,
    yesPrice: yes,
    noPrice: no,
    imageUrl: raw.images?.[0] || undefined,
    endTime: toUnixSeconds(raw.endTime),
  };
}

/** The list endpoint has been seen returning several envelope shapes. */
export function extractMarketList(data: unknown): PantaMarketRaw[] {
  if (Array.isArray(data)) return data as PantaMarketRaw[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["items", "results", "markets", "data"]) {
      if (Array.isArray(d[key])) return d[key] as PantaMarketRaw[];
    }
  }
  return [];
}
