import { NextResponse } from "next/server";
import { PANTA_BASE_URL } from "@/lib/panta/server";

export const dynamic = "force-dynamic";

/**
 * Developer tool: looks for Panta's OpenAPI schema and lists the trading-related
 * paths (buy / sell / orders / positions / claim) so the in-app trading calls can be
 * wired to the real endpoints instead of guessed ones.
 * Disabled in production unless DEBUG_ROUTES=1.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_ROUTES !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const key = process.env.PANTA_API_KEY;
  if (!key) return NextResponse.json({ error: "PANTA_API_KEY not set" }, { status: 500 });

  const base = PANTA_BASE_URL.replace(/\/$/, "");
  const origin = new URL(PANTA_BASE_URL).origin;
  const candidates = [
    `${base}/schema/?format=json`,
    `${base}/schema/`,
    `${base}/openapi.json`,
    `${base}/openapi/`,
    `${base}/swagger.json`,
    `${origin}/api/schema/?format=json`,
    `${origin}/api/schema/`,
    `${origin}/openapi.json`,
    `${origin}/api/openapi.json`,
    `${origin}/api/v1/docs/?format=openapi`,
  ];

  const tried: { url: string; status: number | string }[] = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      tried.push({ url, status: res.status });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as { paths?: Record<string, Record<string, { summary?: string; requestBody?: unknown }>> } | null;
      if (!json?.paths) continue;

      const re = /order|buy|sell|position|claim|trade|redeem|portfolio|receipt|register|quote|build/i;
      const paths = Object.entries(json.paths)
        .filter(([p]) => re.test(p))
        .map(([p, ops]) => ({
          path: p,
          methods: Object.keys(ops).filter((m) => ["get", "post", "put", "patch", "delete"].includes(m)),
          summaries: Object.values(ops).map((o) => o?.summary).filter(Boolean),
        }));
      return NextResponse.json({ schemaUrl: url, totalPaths: Object.keys(json.paths).length, tradingPaths: paths, tried });
    } catch (e) {
      tried.push({ url, status: e instanceof Error ? e.message : "error" });
    }
  }
  return NextResponse.json(
    { error: "No OpenAPI schema found at the usual locations. Copy the buy/sell/claim section from Panta's API docs instead.", tried },
    { status: 404 }
  );
}
