"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { loadPoolByMint, loadPoolsByCreator, type PoolView } from "@/lib/meteora/pools";
import { launchStore } from "@/lib/conviction/store";
import { levelForScore } from "@/lib/conviction/score";

function levelStyles(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (score >= 55) return "bg-violet-500/15 text-violet-400 border-violet-500/30";
  if (score >= 30) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-zinc-800 text-zinc-400 border-zinc-700";
}

export default function LaunchesPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const records = useSyncExternalStore(launchStore.subscribe, launchStore.getSnapshot, launchStore.getServerSnapshot);

  const [pools, setPools] = useState<PoolView[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    setWarning(null);
    let list: PoolView[] = [];
    try {
      list = await loadPoolsByCreator(connection, publicKey);
    } catch (e) {
      // Most likely the RPC plan blocks getProgramAccounts. Fall back to launches this browser knows about.
      setWarning(
        `Could not list all your launches from the chain (${(e instanceof Error ? e.message : String(e)).slice(0, 160)}). Showing launches made from this browser only. See /status.`
      );
    }
    const known = new Set(list.map((p) => p.mint));
    const mine = launchStore.getSnapshot().filter((r) => r.creator === publicKey.toBase58() && !known.has(r.mint));
    const extra = await Promise.all(
      mine.map((r) => loadPoolByMint(connection, r.mint, r.pool).catch(() => null))
    );
    setPools([...list, ...extra.filter((p): p is PoolView => !!p)]);
  }, [connection, publicKey]);

  useEffect(() => {
    if (!ready || !publicKey) return;
    let alive = true;
    (async () => {
      try {
        if (alive) await load();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, publicKey, load]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Launches</h1>
          <p className="text-zinc-400 mt-1">Bonding-curve pools you created — live from the chain</p>
        </div>
        <Link href="/launch" className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition">
          + Launch Token
        </Link>
      </div>

      {!publicKey && <p className="text-zinc-500">Connect your wallet to see your launches.</p>}
      {publicKey && !ready && <p className="text-zinc-500 text-sm">{blockReason}</p>}
      {warning && <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm wrap-break-words">{warning}</div>}
      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm wrap-break-words">{error}</div>}
      {publicKey && ready && pools === null && !error && <p className="text-zinc-500 text-sm">Reading pools from the chain…</p>}

      {pools && pools.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg">No launches from this wallet on this network</p>
          <Link href="/launch" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition">
            Launch Token
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {pools?.map((p) => {
          const rec = records.find((r) => r.mint === p.mint);
          return (
            <Link
              key={p.pool}
              href={`/launches/${p.mint}`}
              className="block p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">
                    {p.name || rec?.name || "Unnamed"} <span className="text-zinc-500 font-normal">(${p.symbol || rec?.symbol || "?"})</span>
                  </h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-zinc-400">
                    <span>Price {p.priceSol.toPrecision(3)} SOL</span>
                    <span>MC {p.marketCapSol.toLocaleString(undefined, { maximumFractionDigits: 1 })} SOL</span>
                    <span>Fee {(p.feeBps / 100).toFixed(2)}%</span>
                    <span>{p.isMigrated ? "Graduated" : `${(p.progress * 100).toFixed(0)}% to graduation`}</span>
                  </div>
                </div>
                {rec && (
                  <div className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${levelStyles(rec.convictionScore)}`}>
                    {levelForScore(rec.convictionScore)} · {rec.convictionScore}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
