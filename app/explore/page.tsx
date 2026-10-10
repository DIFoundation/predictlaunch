"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { loadPoolByMint, type PoolView } from "@/lib/meteora/pools";
import { launchStore } from "@/lib/conviction/store";

const MAX_TRACKED_LAUNCHES = 8;
const LOAD_CONCURRENCY = 2;

export default function ExplorePage() {
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const records = useSyncExternalStore(
    launchStore.subscribe,
    launchStore.getSnapshot,
    launchStore.getServerSnapshot
  );
  const [pools, setPools] = useState<PoolView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setPools(null);

    // Only read pool addresses that this browser already knows from successful
    // PredictLaunch launches. Never scan Meteora's shared DBC program globally:
    // getPools() can return tens of MB and exhaust RPC provider limits.
    const candidates = records.slice(0, MAX_TRACKED_LAUNCHES);
    if (candidates.length === 0) {
      setPools([]);
      return;
    }

    const active: PoolView[] = [];
    let nextIndex = 0;
    let failures = 0;

    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= candidates.length) return;
        const record = candidates[index];
        try {
          // Passing the known pool address keeps this on direct account reads;
          // it avoids the SDK's getPoolByBaseMint program-wide fallback.
          const pool = await loadPoolByMint(connection, record.mint, record.pool);
          if (!pool) continue;

          // Explore is an active bonding-curve feed. Graduated pools are no
          // longer active on the DBC curve, and a full curve is not tradeable
          // through the same lifecycle either.
          if (
            !pool.isMigrated &&
            pool.migrationThresholdSol > 0 &&
            pool.quoteReserveSol < pool.migrationThresholdSol
          ) {
            active.push({
              ...pool,
              name: pool.name || record.name,
              symbol: pool.symbol || record.symbol,
            });
          }
        } catch {
          failures += 1;
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(LOAD_CONCURRENCY, candidates.length) },
        () => worker()
      )
    );

    if (active.length === 0 && failures > 0) {
      setError(
        "Could not load tracked markets from the RPC right now. The provider may be rate-limiting requests; wait a moment and retry."
      );
    }
    setPools(active.sort((a, b) => b.quoteReserveSol - a.quoteReserveSol));
  }, [connection, records]);

  useEffect(() => {
    if (!ready) return;
    // Defer loading so state updates happen outside the effect's synchronous body.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Explore</h1>
        <p className="text-zinc-400 mt-1">
          Active bonding-curve markets tracked by PredictLaunch on this browser.
        </p>
      </div>

      {!ready && <p className="text-zinc-500 text-sm">{blockReason}</p>}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm wrap-break-words">
          {error}
        </div>
      )}
      {ready && pools === null && !error && (
        <p className="text-zinc-500 text-sm">Loading active tracked markets…</p>
      )}
      {pools && pools.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          No active tracked markets found. Launch a token from this browser or
          open a token you launched previously to add it to your tracked list.
        </div>
      )}

      <div className="grid gap-4">
        {pools?.map((p) => (
          <Link
            key={p.pool}
            href={`/launches/${p.mint}`}
            className="block p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">
                  {p.name || "Unnamed"}{" "}
                  <span className="text-zinc-500 font-normal">
                    (${p.symbol || "?"})
                  </span>
                </h3>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-zinc-400">
                  <span>Price {p.priceSol.toPrecision(3)} SOL</span>
                  <span>
                    MC{" "}
                    {p.marketCapSol.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    SOL
                  </span>
                  <span>Fee {(p.feeBps / 100).toFixed(2)}%</span>
                  <span>
                    {p.progress >= 1
                      ? "Curve complete"
                      : `${(p.progress * 100).toFixed(0)}% to graduation`}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-emerald-400">Active</span>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void load()}
        disabled={!ready}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
      >
        Refresh markets
      </button>
    </div>
  );
}
