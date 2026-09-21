import Link from "next/link";
import { pantaServer } from "@/lib/panta/server";
import { PantaMarket } from "@/types/panta";

export default async function MarketsPage() {
  let markets: PantaMarket[] = [];
  let error: string | null = null;

  try {
    const data = await pantaServer.listMarkets({ limit: 30 });
    markets = data.items || data.results || data || [];
  } catch (err: any) {
    error = err.message || "Failed to load markets";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-zinc-400 mt-1">
            Prediction markets powered by Panta
          </p>
        </div>
        <Link
          href="/create"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
        >
          + Create Market
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
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
        {markets.map((market: PantaMarket) => {
          const id = market.marketId;
          return (
            <Link
              key={id}
              href={`/markets/${id}`}
              className="block p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition"
            >
              <h3 className="font-medium text-lg line-clamp-2">
                {market.title || "Untitled Market"}
              </h3>

              <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-400">
                <span className="capitalize">{market.category || "—"}</span>
                <span>Status: {market.phase || market.status || "—"}</span>
                {market.volumeUsdc && (
                  <span>Volume: ${Number(market.volumeUsdc).toLocaleString()}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}