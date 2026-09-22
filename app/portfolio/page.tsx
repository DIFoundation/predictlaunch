"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PANTA_WRITES_ENABLED, txUrl } from "@/lib/config/network";
import { sendAndConfirm } from "@/lib/rpc/connection";
import { decodeTx, extractTxB64 } from "@/lib/panta/tx";
import { useNetwork } from "@/components/network/NetworkProvider";
import { loadPoolByMint, tokenBalance, type PoolView } from "@/lib/meteora/pools";
import { launchStore } from "@/lib/conviction/store";
import type { PantaMarket } from "@/types/panta";

interface Holding {
  pool: PoolView;
  balance: number;
  valueSol: number;
}

interface PantaPos {
  marketId: string;
  side?: string;
  shares?: string;
  phase?: string | number;
  claimable?: boolean;
  claimed?: boolean;
  outcome?: string | null;
  market?: PantaMarket;
}

export default function PortfolioPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const records = useSyncExternalStore(launchStore.subscribe, launchStore.getSnapshot, launchStore.getServerSnapshot);
  const seen = useSyncExternalStore(launchStore.subscribe, launchStore.getMintsSnapshot, launchStore.getMintsServerSnapshot);

  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [positions, setPositions] = useState<PantaPos[] | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const load = useCallback(async () => {
    if (!publicKey) return;
    setError(null);

    // 1) SOL + token holdings (live balances; token list = launches + tokens traded in this app)
    try {
      setSol((await connection.getBalance(publicKey)) / 1e9);
      const mints = [...new Set([...records.map((r) => r.mint), ...seen])];
      const poolAddr = new Map(records.map((r) => [r.mint, r.pool]));
      const rows = await Promise.all(
        mints.map(async (mint): Promise<Holding | null> => {
          try {
            const pool = await loadPoolByMint(connection, mint, poolAddr.get(mint));
            if (!pool) return null;
            const raw = await tokenBalance(connection, new PublicKey(publicKey), mint);
            const balance = raw / 10 ** pool.decimals;
            return { pool, balance, valueSol: balance * pool.priceSol };
          } catch {
            return null;
          }
        })
      );
      setHoldings(rows.filter((r): r is Holding => !!r && r.balance > 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }

    // 2) Panta prediction-market positions (real API, wallet-scoped)
    try {
      setPosError(null);
      const res = await fetch(`/api/panta/positions?wallet=${publicKey.toBase58()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Positions request failed (${res.status})`);
      const items = (data.items ?? []) as PantaPos[];
      const ids = [...new Set(items.map((p) => p.marketId))].slice(0, 25);
      const marketMap = new Map<string, PantaMarket>();
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/panta/markets/${encodeURIComponent(id)}`);
            if (r.ok) marketMap.set(id, (await r.json()) as PantaMarket);
          } catch {
            /* title is a nicety */
          }
        })
      );
      setPositions(items.map((p) => ({ ...p, market: marketMap.get(p.marketId) })));
    } catch (e) {
      setPosError(e instanceof Error ? e.message : String(e));
      setPositions([]);
    }
  }, [connection, publicKey, records, seen]);

  useEffect(() => {
    if (!ready || !publicKey) return;
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [ready, publicKey, load, reloadTick]);

  async function claim(marketId: string) {
    if (!publicKey || !signTransaction) return;
    setClaiming(marketId);
    setClaimMsg(null);
    try {
      const post = async (url: string, body: unknown) => {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
        return d;
      };
      const build = await post("/api/panta/claim/build", { wallet: publicKey.toBase58(), marketId });
      const b64 = extractTxB64(build);
      if (!b64) throw new Error("Panta's claim response had no transaction. Keys: " + Object.keys(build).join(", "));
      const signed = await signTransaction(decodeTx(b64));
      const signature = await sendAndConfirm(connection, signed);
      setClaimMsg({ ok: true, text: `Claimed! ${txUrl(signature)}` });
      setReloadTick((t) => t + 1);
    } catch (e) {
      setClaimMsg({ ok: false, text: e instanceof Error ? e.message : "Claim failed" });
    } finally {
      setClaiming(null);
    }
  }

  const totalValue = holdings?.reduce((s, h) => s + h.valueSol, 0) ?? 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-zinc-400 mt-1">Everything you hold, read live from Solana and Panta</p>
      </div>

      {!publicKey && <p className="text-zinc-500">Connect your wallet to see your portfolio.</p>}
      {publicKey && !ready && <p className="text-zinc-500 text-sm">{blockReason}</p>}
      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm wrap-break-words">{error}</div>}

      {publicKey && ready && (
        <>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <p className="text-xs text-zinc-500">SOL balance</p>
              <p className="font-medium mt-1">{sol === null ? "—" : sol.toFixed(4)}</p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <p className="text-xs text-zinc-500">Launched-token value</p>
              <p className="font-medium mt-1">{holdings === null ? "—" : `${totalValue.toFixed(4)} SOL`}</p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Launched tokens</h2>
            {holdings === null && <p className="text-zinc-500 text-sm">Loading…</p>}
            {holdings?.length === 0 && (
              <p className="text-zinc-500 text-sm">
                No balances yet. Buy a token from <Link href="/launches" className="underline">your launches</Link> or open a token page to start.
              </p>
            )}
            <div className="grid gap-3">
              {holdings?.map((h) => (
                <Link key={h.pool.mint} href={`/launches/${h.pool.mint}`} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition">
                  <div>
                    <p className="font-medium">
                      {h.pool.name || "Unnamed"} <span className="text-zinc-500">(${h.pool.symbol || "?"})</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {h.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens @ {h.pool.priceSol.toPrecision(3)} SOL
                    </p>
                  </div>
                  <p className="text-sm">{h.valueSol.toFixed(4)} SOL</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Prediction-market positions <span className="text-xs text-zinc-500 font-normal">Powered by Panta</span>
            </h2>
            {posError && <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm wrap-break-words">{posError}</div>}
            {claimMsg && (
              <div className={`p-3 rounded-lg border text-sm wrap-break-words ${claimMsg.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                {claimMsg.text}
              </div>
            )}
            {positions === null && <p className="text-zinc-500 text-sm">Loading…</p>}
            {positions?.length === 0 && !posError && <p className="text-zinc-500 text-sm">No open positions.</p>}
            <div className="grid gap-3">
              {positions?.map((p, i) => (
                <div key={`${p.marketId}-${i}`}>
                <Link href={`/markets/${p.marketId}`} className="block p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition">
                  <p className="font-medium line-clamp-2">{p.market?.title ?? `Market ${p.marketId.slice(0, 8)}…`}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-zinc-400">
                    <span className="uppercase">{p.side ?? "—"}</span>
                    <span>{p.shares ? `${Number(p.shares).toLocaleString()} shares` : "—"}</span>
                    {p.claimed ? <span className="text-zinc-500">claimed</span> : p.claimable ? <span className="text-emerald-400">claimable</span> : null}
                  </div>
                </Link>
                {p.claimable && !p.claimed && PANTA_WRITES_ENABLED && (
                  <button
                    type="button"
                    onClick={() => claim(p.marketId)}
                    disabled={claiming !== null}
                    className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {claiming === p.marketId ? "Claiming…" : "Claim winnings"}
                  </button>
                )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
