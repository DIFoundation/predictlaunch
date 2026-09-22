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

// ---------------------------------------------------------------------------
// /markets/{id}/prices/ overlay + /categories/ parsing.
// The response shapes are not in Panta's schema, so these read defensively:
// unknown shape => no change (never invents data).
// ---------------------------------------------------------------------------

function firstDefined(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

/** Overlay live on-chain prices/volume from /prices/ onto the catalog row. */
export function overlayPrices(raw: PantaMarketRaw, prices: unknown): PantaMarketRaw {
  if (!prices || typeof prices !== "object") return raw;
  const root = prices as Record<string, unknown>;
  // Tolerate { data: {...} } / { prices: {...} } envelopes.
  const p = ((root.data ?? root.prices ?? root) as Record<string, unknown>) || root;

  const yes = firstDefined(p, ["yesPrice", "yes_price", "priceYes", "yes", "primaryYesPrice", "secondaryYesPrice"]);
  const no = firstDefined(p, ["noPrice", "no_price", "priceNo", "no", "primaryNoPrice", "secondaryNoPrice"]);
  const vol = firstDefined(p, ["volumeUsdc", "volume_usdc", "volume", "totalVolume", "totalVolumeUsdc"]);

  return {
    ...raw,
    ...(yes !== undefined ? { yesPrice: yes as string | number } : {}),
    ...(no !== undefined ? { noPrice: no as string | number } : {}),
    ...(vol !== undefined ? { volumeUsdc: vol as string | number } : {}),
  };
}

/** Accepts ["crypto", ...] or [{ slug|id|value|name|label }, ...] or { items|results|categories: [...] }. */
export function extractCategories(data: unknown): { value: string; label: string }[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["items", "results", "categories", "data"]) {
      if (Array.isArray(d[k])) {
        list = d[k] as unknown[];
        break;
      }
    }
  }
  const out: { value: string; label: string }[] = [];
  for (const c of list) {
    if (typeof c === "string") out.push({ value: c, label: c });
    else if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      const value = firstDefined(o, ["slug", "id", "value", "key", "name"]);
      const label = firstDefined(o, ["name", "label", "title", "slug", "id", "value"]);
      if (typeof value === "string" || typeof value === "number") {
        out.push({ value: String(value), label: String(label ?? value) });
      }
    }
  }
  return out;
}
