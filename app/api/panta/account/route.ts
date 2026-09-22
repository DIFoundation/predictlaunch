import { NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";

export const dynamic = "force-dynamic";

/** Trades + metrics attributed to OUR API key: the proof that volume is routed through PredictLaunch. */
export async function GET() {
  const [metrics, trades] = await Promise.allSettled([
    pantaServer.getAccountMetrics(),
    pantaServer.getAccountTrades(),
  ]);
  const unwrap = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? { ok: true, data: r.value } : { ok: false, error: String(r.reason?.message ?? r.reason) };
  return NextResponse.json({ metrics: unwrap(metrics), trades: unwrap(trades) });
}
