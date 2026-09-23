"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { loadAllPools, type PoolView } from "@/lib/meteora/pools";

export default function ExplorePage() {
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const [pools, setPools] = useState<PoolView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPools(await loadAllPools(connection));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [connection]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [ready, load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Explore</h1>
        <p className="text-zinc-400 mt-1">Every PredictLaunch-style token live on this network, straight from the chain.</p>
      </div>

      {!ready && <p className="text-zinc-500 text-sm">{blockReason}</p>}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm wrap-break-words">
          {error}
          {error.includes("403") && <p className="mt-2 text-amber-300">This uses getProgramAccounts, which some RPC plans block. See /status.</p>}
        </div>
      )}
      {ready && pools === null && !error && <p className="text-zinc-500 text-sm">Reading every pool from the chain…</p>}
      {pools && pools.length === 0 && <p className="text-zinc-500 text-sm">No Meteora DBC pools found on this network yet.</p>}

      <div className="grid gap-4">
        {pools?.map((p) => (
          <Link key={p.pool} href={`/launches/${p.mint}`} className="block p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">
                  {p.name || "Unnamed"} <span className="text-zinc-500 font-normal">(${p.symbol || "?"})</span>
                </h3>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-zinc-400">
                  <span>Price {p.priceSol.toPrecision(3)} SOL</span>
                  <span>MC {p.marketCapSol.toLocaleString(undefined, { maximumFractionDigits: 1 })} SOL</span>
                  <span>Fee {(p.feeBps / 100).toFixed(2)}%</span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">{p.isMigrated ? "Graduated" : `${(p.progress * 100).toFixed(0)}% to graduation`}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
