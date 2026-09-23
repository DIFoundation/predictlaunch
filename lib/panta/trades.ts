/**
 * GET /markets/{market_id}/trades/ has no documented response shape (Panta's schema gives only
 * the description "Balr trade history for a market"). This parses defensively: several common
 * field-name variants, unknown shapes -> empty array (the chart then shows a "not enough
 * history" message instead of guessing numbers).
 */
export interface MarketTrade {
  /** unix seconds, or null if not parseable */
  time: number | null;
  /** 0..1 YES price, or null */
  price: number | null;
  side: "yes" | "no" | null;
  sizeUsdc: number | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toUnixSeconds(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : n;
  const ms = Date.parse(String(v));
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function toProbability(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  const p = n > 1 ? n / 100 : n;
  return p >= 0 && p <= 1 ? p : null;
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

export function normalizeTrades(data: unknown): MarketTrade[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["items", "results", "trades", "data"]) {
      if (Array.isArray(d[k])) {
        list = d[k] as unknown[];
        break;
      }
    }
  }

  return list
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => {
      const side = pick(t, ["side", "outcome"]);
      const sideNorm = typeof side === "string" ? (side.toLowerCase().startsWith("y") ? "yes" : side.toLowerCase().startsWith("n") ? "no" : null) : null;
      let price = toProbability(pick(t, ["yesPrice", "price", "avgPrice", "fillPrice"]));
      // Some trade feeds only give the price of whichever side was traded; convert NO price to YES price.
      if (price !== null && sideNorm === "no") price = 1 - price;
      return {
        time: toUnixSeconds(pick(t, ["timestamp", "time", "createdAt", "ts", "blockTime"])),
        price,
        side: sideNorm,
        sizeUsdc: num(pick(t, ["sizeUsdc", "amountUsdc", "size", "notionalUsdc"])),
      };
    });
}
