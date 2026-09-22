import { NextRequest, NextResponse } from "next/server";
import { pantaFetch, pantaServer } from "@/lib/panta/server";
import { extractMarketList } from "@/lib/panta/normalize";

export const dynamic = "force-dynamic";

/**
 * Developer tool: shows what Panta's trading endpoints expect and return, so the request bodies in
 * lib/panta/trade-spec.ts can be finalised without guessing.
 *   - POSTs an EMPTY body to each trading endpoint. Panta answers 400 with the required field names.
 *     (An empty body cannot build or move anything.)
 *   - GETs a few read endpoints to show their response shape.
 * Optional: /api/panta/probe?wallet=<your wallet> also shows your positions.
 * Disabled in production unless DEBUG_ROUTES=1.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_ROUTES !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet");

  async function attempt(label: string, fn: () => Promise<unknown>) {
    try {
      const data = await fn();
      return { label, ok: true, body: JSON.stringify(data).slice(0, 1500) };
    } catch (e) {
      return { label, ok: false, body: (e instanceof Error ? e.message : String(e)).slice(0, 700) };
    }
  }

  // A market id for the /prices/ sample.
  let firstId: string | null = null;
  try {
    firstId = extractMarketList(await pantaServer.listMarkets({ limit: 1 }))[0]?.marketId ?? null;
  } catch {
    /* ignore */
  }

  const post = (path: string) => () => pantaFetch(path, { method: "POST", body: "{}" });

  const results = await Promise.all([
    attempt("POST /primaryorderquote/  (empty body)", post("/primaryorderquote/")),
    attempt("POST /primaryorderbuild/  (empty body)", post("/primaryorderbuild/")),
    attempt("POST /primaryordersubmit/ (empty body)", post("/primaryordersubmit/")),
    attempt("POST /primaryorderverify/ (empty body)", post("/primaryorderverify/")),
    attempt("POST /claim/build/        (empty body)", post("/claim/build/")),
    attempt("POST /trades/             (empty body)", post("/trades/")),
    attempt("POST /markets/create/image-upload/ (empty body)", post("/markets/create/image-upload/")),
    attempt("GET  /categories/", () => pantaServer.getCategories()),
    attempt(`GET  /markets/${firstId}/prices/`, () => (firstId ? pantaServer.getMarketPrices(firstId) : Promise.reject(new Error("no market id")))),
    attempt("GET  /account/metrics/", () => pantaServer.getAccountMetrics()),
    attempt("GET  /account/trades/", () => pantaServer.getAccountTrades()),
    ...(wallet ? [attempt(`GET  /positions/?wallet=${wallet.slice(0, 6)}…`, () => pantaServer.getPositions(wallet))] : []),
  ]);

  return NextResponse.json({ note: "Paste this whole JSON back so trade-spec.ts can be finalised.", results });
}
