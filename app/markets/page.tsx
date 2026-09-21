import Link from "next/link";
import { pantaServer } from "@/lib/panta/server";
import { extractMarketList, normalizeMarket } from "@/lib/panta/normalize";
import type { PantaMarket } from "@/types/panta";

// Without this Next prerenders the page at BUILD time and freezes whatever
// Panta returned (or the missing-API-key error) into the deployed site.
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  let markets: PantaMarket[] = [];
  let error: string | null = null;

  try {
    const data = await pantaServer.listMarkets({ limit: 30 });
    markets = extractMarketList(data).map(normalizeMarket);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load markets";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-zinc-400 mt-1">
            Prediction markets · <span className="text-zinc-300">Powered by Panta</span>
          </p>
        </div>
        <Link
          href="/create"
          className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
        >
          + Create Market
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap break-words">
          {error}
        </div>
      )}

      {!error && markets.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          <p>No markets found yet.</p>
          <p className="text-sm mt-2">Create the first one to get started.</p>
        </div>
      )}

      <div className="grid gap-4">
        {markets.map((m) => (
          <Link
            key={m.marketId}
            href={`/markets/${m.marketId}`}
            className="block p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition"
          >
            <h3 className="font-medium text-lg line-clamp-2">{m.title}</h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-zinc-400">
              <span className="capitalize">{m.category}</span>
              <span className="capitalize">Phase: {m.phase}</span>
              <span>Volume: ${m.volumeUsdc.toLocaleString()}</span>
              <span>YES: {m.yesPrice === null ? "no live price" : `${Math.round(m.yesPrice * 100)}%`}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
