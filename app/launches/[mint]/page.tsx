"use client";

import { use, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { TokenTradePanel } from "@/components/trade/TokenTradePanel";
import { CurveChart } from "@/components/charts/CurveChart";
import { loadPoolByMint, type PoolView } from "@/lib/meteora/pools";
import { launchStore } from "@/lib/conviction/store";
import { levelForScore } from "@/lib/conviction/score";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/45 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium mt-1 wrap-break-words">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();

  const records = useSyncExternalStore(launchStore.subscribe, launchStore.getSnapshot, launchStore.getServerSnapshot);
  const localRecord = records.find((r) => r.mint === mint);
  const [sharedRecord, setSharedRecord] = useState<typeof localRecord>(undefined);

  useEffect(() => {
    if (localRecord) return;
    let alive = true;
    fetch("/api/launches?limit=200")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Shared directory unavailable");
        return data;
      })
      .then((data) => {
        if (!alive || !Array.isArray(data.items)) return;
        const found = data.items.find((item: { mint?: string }) => item.mint === mint);
        if (found) setSharedRecord(found);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [mint, localRecord]);

  const record = localRecord ?? sharedRecord;
  const poolHint = record?.pool;

  const [pool, setPool] = useState<PoolView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const run = async () => {
      try {
        const p = await loadPoolByMint(connection, mint, poolHint);
        if (!alive) return;
        if (!p) return setState("missing");
        launchStore.rememberPool(mint, p.pool);
        setPool(p);
        setState("ok");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ready, connection, mint, poolHint, reloadTick]);

  return (
    <div className="space-y-7">
      <Link href="/launches" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"><ArrowLeft size={15} /> My launches</Link>

      {!ready && <p className="text-zinc-500 text-sm">{blockReason}</p>}
      {ready && state === "loading" && <p className="text-zinc-500 text-sm">Reading pool from the chain…</p>}
      {state === "missing" && (
        <div className="p-6 rounded-lg border border-zinc-800 text-zinc-400 text-sm">
          No Meteora bonding-curve pool was found for <code className="break-all">{mint}</code> on this network.
          Check that the app network matches where the token was launched.
        </div>
      )}
      {state === "error" && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">
          {error}
          {error?.includes("403") && (
            <p className="mt-2 text-amber-300">
              Looking up a pool by mint uses getProgramAccounts, which some RPC plans block. See /status.
            </p>
          )}
        </div>
      )}

      {pool && (
        <>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {pool.name || record?.name || "Unnamed token"}{" "}
              <span className="text-zinc-500 font-normal">(${pool.symbol || record?.symbol || "?"})</span>
            </h1>
            <p className="text-xs text-zinc-600 mt-2 break-all">Mint: {pool.mint}</p>
            {record && (
              <p className="text-xs text-zinc-500 mt-1">
                Launched with conviction {record.convictionScore}/100 ({levelForScore(record.convictionScore)})
                {record.linkedMarketIds[0] && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/markets/${record.linkedMarketIds[0]}`} className="underline hover:text-white">
                      linked market
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Price" value={`${pool.priceSol.toPrecision(4)} SOL`} />
            <Stat label="Market cap" value={`${pool.marketCapSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`} />
            <Stat label="Trading fee" value={`${(pool.feeBps / 100).toFixed(2)}%`} sub="set by conviction" />
            <Stat label="Curve raised" value={`${pool.quoteReserveSol.toFixed(3)} SOL`} sub={`of ${pool.migrationThresholdSol.toLocaleString()} SOL`} />
          </div>

          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>Progress to graduation</span>
              <span className="font-mono text-emerald-300">{(pool.progress * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-liner-to-r from-emerald-500 to-lime-300 transition-all" style={{ width: `${pool.progress * 100}%` }} />
            </div>
          </div>

          <CurveChart points={pool.curveShape} current={{ quoteReserveSol: pool.quoteReserveSol, priceSol: pool.priceSol }} />

          <TokenTradePanel pool={pool} poolAddress={record?.pool ?? pool.pool} onTraded={() => setReloadTick((t) => t + 1)} />
        </>
      )}
    </div>
  );
}
