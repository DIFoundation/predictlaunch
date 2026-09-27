"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { calculateConviction, feeBpsForScore } from "@/lib/conviction/score";
import { launchStore } from "@/lib/conviction/store";
import { ConvictionPanel } from "@/components/conviction/ConvictionPanel";
import { useNetwork } from "@/components/network/NetworkProvider";
import { prepareLaunch, simulateLaunch, sendLaunch } from "@/lib/meteora/client";
import { buildMetadataUri } from "@/lib/meteora/metadataUri";
import { IS_MAINNET, isPublicHttpsUrl, txUrl } from "@/lib/config/network";
import type { LinkedMarket, LaunchRecord } from "@/types/conviction";
import type { PantaMarket } from "@/types/panta";

type Fetched = { market?: LinkedMarket; error?: string };

function toLinked(m: PantaMarket): LinkedMarket {
  return { marketId: m.marketId, question: m.title, volumeUsdc: m.volumeUsdc, yesPrice: m.yesPrice };
}

function LaunchForm() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>(() => {
    const ids = searchParams.get("market");
    return ids ? ids.split(",").map((id) => id.trim()).filter(Boolean) : [];
  });
  const [marketInput, setMarketInput] = useState("");
  const [markets, setMarkets] = useState<PantaMarket[]>([]);
  const [fetched, setFetched] = useState<Record<string, Fetched>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchRecord | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/panta/markets")
      .then((r) => r.json())
      .then((d) => alive && Array.isArray(d.items) && setMarkets(d.items))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const ids = selectedMarketIds.filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(`/api/panta/markets/${encodeURIComponent(id)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Lookup failed (${res.status})`);
          return [id, { market: toLinked(data as PantaMarket) }] as const;
        } catch (e) {
          return [id, { error: e instanceof Error ? e.message : "Lookup failed" }] as const;
        }
      }));
      if (!cancelled) setFetched((current) => ({ ...current, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
  }, [selectedMarketIds]);

  const linkedMarkets = useMemo(
    () => selectedMarketIds.map((id) => fetched[id]?.market).filter((m): m is LinkedMarket => Boolean(m)),
    [selectedMarketIds, fetched],
  );
  const unresolvedIds = selectedMarketIds.filter((id) => !fetched[id]);
  const lookupErrors = selectedMarketIds.map((id) => fetched[id]?.error).filter(Boolean) as string[];
  const conviction = linkedMarkets.length ? calculateConviction(linkedMarkets) : null;
  const score = conviction?.score ?? 0;
  const feeBps = feeBpsForScore(score);

  function toggleMarket(id: string) {
    setSelectedMarketIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function addManualMarkets() {
    const ids = marketInput.split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return;
    setSelectedMarketIds((current) => Array.from(new Set([...current, ...ids])));
    setMarketInput("");
  }

  function validate(): string | null {
    if (!publicKey || !signTransaction) return "Please connect your wallet first";
    if (!ready) return blockReason;
    if (!name.trim() || !symbol.trim()) return "Name and symbol are required";
    if (name.trim().length > 32) return "Token name must be 32 characters or fewer";
    if (symbol.trim().length > 10) return "Symbol must be 10 characters or fewer";
    if (unresolvedIds.length) return "Wait for all selected markets to finish loading.";
    if (lookupErrors.length) return "One or more selected markets could not be loaded. Remove them and try again.";
    if (IS_MAINNET && !isPublicHttpsUrl(window.location.origin)) return "On mainnet the token metadata URL must be public HTTPS. Deploy the app (or open it via a public https URL) before launching for real.";
    return null;
  }

  async function launchOnChain() {
    const v = validate();
    if (v) return setError(v);
    if (!publicKey || !signTransaction) return;
    if (IS_MAINNET && !window.confirm(`MAINNET: this creates a real Meteora bonding-curve pool and spends real SOL (account rent + fees).\n\nToken: ${name.trim()} (${symbol.trim().toUpperCase()})\nConviction: ${score}/100\nTrading fee: ${(feeBps / 100).toFixed(2)}%\nLinked markets: ${linkedMarkets.length}\n\nContinue?`)) return;

    setBusy(true); setError(null); setResult(null);
    try {
      setStatus("Building Meteora config + pool transaction...");
      const uri = buildMetadataUri(window.location.origin, { name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim() || undefined, imageUrl: imageUrl.trim() || undefined });
      const prepared = await prepareLaunch(connection, { name: name.trim(), symbol: symbol.trim().toUpperCase(), uri, feeBps, payer: publicKey });
      setStatus("Simulating transaction on the RPC...");
      const simulation = await simulateLaunch(connection, prepared.tx);
      console.info("Meteora launch simulation", simulation);
      setStatus(
        `Simulation passed${simulation.unitsConsumed !== null ? ` · ${simulation.unitsConsumed.toLocaleString()} compute units` : ""}. Signing and submitting from your wallet...`
      );
      const signature = await sendLaunch(connection, prepared, signTransaction);
      const rec: LaunchRecord = {
        mint: prepared.baseMint, pool: prepared.pool, config: prepared.config, signature,
        name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim() || undefined,
        linkedMarketIds: selectedMarketIds, convictionScore: score, feeBps,
        createdAt: new Date().toISOString(), creator: publicKey.toBase58(),
      };
      launchStore.add(rec); launchStore.rememberMint(rec.mint); setResult(rec);
      setStatus("Token + bonding curve pool created on-chain!");
    } catch (e) {
      console.error("Meteora launch failed", e);
      const err = e as { message?: unknown; code?: unknown; cause?: { message?: unknown } };
      const message = typeof err?.message === "string" ? err.message : "Launch failed";
      const cause = typeof err?.cause?.message === "string" ? `\nWallet/provider detail: ${err.cause.message}` : "";
      const code = err?.code !== undefined ? ` [code ${String(err.code)}]` : "";
      setError(`${message}${code}${cause}`);
      setStatus(null);
    } finally { setBusy(false); }
  }

  const inputCls = "w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Launch Token</h1>
        <p className="text-zinc-400 mt-2">Measure demand across prediction markets, then use the resulting conviction to configure your Meteora bonding curve.</p>
      </div>

      <div className="space-y-6">
        <div><label className="block text-sm font-medium mb-2">Token Name *</label><input className={inputCls} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="PredictLaunch Token" disabled={busy} /></div>
        <div><label className="block text-sm font-medium mb-2">Symbol *</label><input className={inputCls} value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="PLT" disabled={busy} /></div>
        <div><label className="block text-sm font-medium mb-2">Description</label><textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this token about?" disabled={busy} /></div>
        <div><label className="block text-sm font-medium mb-2">Image URL (optional)</label><input className={inputCls} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... (a public logo image)" disabled={busy} /><p className="text-xs text-zinc-500 mt-1.5">Shown by wallets and explorers. If metadata is too large, description is dropped first, then image.</p></div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-4"><div><label className="block text-sm font-medium">Prediction markets</label><p className="text-xs text-zinc-500 mt-1">Link multiple independent Panta markets to make conviction harder to game.</p></div><span className="text-xs text-violet-300">{selectedMarketIds.length} selected</span></div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 divide-y divide-zinc-800">
            {markets.length === 0 ? <p className="p-4 text-sm text-zinc-500">Loading live markets…</p> : markets.slice(0, 30).map((m) => {
              const selected = selectedMarketIds.includes(m.marketId);
              return <label key={m.marketId} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-zinc-900/70"><input type="checkbox" checked={selected} onChange={() => toggleMarket(m.marketId)} disabled={busy} className="mt-1 accent-violet-500" /><span className="min-w-0"><span className="block text-sm text-zinc-200 line-clamp-2">{m.title}</span><span className="block text-xs text-zinc-500 mt-1">{m.yesPrice === null ? "No live price" : `${(m.yesPrice * 100).toFixed(1)}% YES`} · ${m.volumeUsdc.toLocaleString()} volume</span></span></label>;
            })}
          </div>
          <div className="flex gap-2"><input className={`${inputCls} text-sm`} value={marketInput} onChange={(e) => setMarketInput(e.target.value)} placeholder="Paste market IDs, comma-separated" disabled={busy} /><button type="button" onClick={addManualMarkets} disabled={busy || !marketInput.trim()} className="px-4 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50">Add</button></div>
          {selectedMarketIds.length > 0 && <div className="flex flex-wrap gap-2">{selectedMarketIds.map((id) => <button type="button" key={id} onClick={() => toggleMarket(id)} disabled={busy} className="text-xs px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/20 hover:bg-violet-500/25">{id.slice(0, 12)}… ×</button>)}</div>}
          {unresolvedIds.length > 0 && <p className="text-xs text-zinc-500">Loading {unresolvedIds.length} selected market{unresolvedIds.length === 1 ? "" : "s"}…</p>}
          {lookupErrors.map((e, i) => <p key={i} className="text-xs text-red-400 whitespace-pre-wrap">{e}</p>)}
        </div>

        {conviction ? <ConvictionPanel conviction={conviction} /> : <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">No prediction markets linked — this launch uses the standard {(feeBpsForScore(0) / 100).toFixed(2)}% base fee.</div>}

        {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">{error}</div>}
        {status && <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">{status}</div>}

        {result && <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-2"><p className="text-emerald-300 font-medium">Launched on-chain</p><p className="text-zinc-400">Conviction <strong>{result.convictionScore}/100</strong> · fee <strong>{(result.feeBps / 100).toFixed(2)}%</strong> · {result.linkedMarketIds.length} linked markets</p><div className="flex flex-wrap gap-4"><Link href={`/launches/${result.mint}`} className="text-violet-300 hover:underline font-medium">Open token page & trade →</Link><a className="text-zinc-400 hover:underline" href={txUrl(result.signature)} target="_blank" rel="noreferrer">Transaction ↗</a></div></div>}

        {!IS_MAINNET && publicKey && (
          <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5 text-xs text-sky-300">
            Devnet launch: make sure your wallet is in testnet/development mode with <strong>Solana Devnet</strong> selected. The app RPC and your wallet must use the same network.
          </div>
        )}

        <button type="button" onClick={launchOnChain} disabled={busy || !publicKey || !ready || unresolvedIds.length > 0 || lookupErrors.length > 0} className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition">{busy ? "Working..." : !publicKey ? "Connect Wallet First" : !ready ? "Waiting for RPC…" : "Launch on Meteora"}</button>
        {publicKey && !ready && blockReason && <p className="text-xs text-red-400">{blockReason}</p>}
      </div>
    </div>
  );
}

export default function LaunchTokenPage() {
  return <Suspense fallback={<p className="text-zinc-500">Loading...</p>}><LaunchForm /></Suspense>;
}
