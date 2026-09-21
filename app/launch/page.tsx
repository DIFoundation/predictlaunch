"use client";

import { Suspense, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { calculateConviction, feeBpsForScore } from "@/lib/conviction/score";
import { launchStore } from "@/lib/conviction/store";
import { ConvictionPanel } from "@/components/conviction/ConvictionPanel";
import { useNetwork } from "@/components/network/NetworkProvider";
import { prepareLaunch, simulateLaunch, sendLaunch } from "@/lib/meteora/client";
import { IS_MAINNET, isPublicHttpsUrl, txUrl } from "@/lib/config/network";
import type { LinkedMarket, LaunchRecord } from "@/types/conviction";
import type { PantaMarket } from "@/types/panta";

type Fetched = { id: string; market?: LinkedMarket; error?: string };

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
  const [linkedMarketId, setLinkedMarketId] = useState(searchParams.get("market") ?? "");

  const [markets, setMarkets] = useState<PantaMarket[]>([]);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchRecord | null>(null);

  // Real, live market list for the picker.
  useEffect(() => {
    let alive = true;
    fetch("/api/panta/markets")
      .then((r) => r.json())
      .then((d) => alive && Array.isArray(d.items) && setMarkets(d.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Load the REAL linked market (debounced).
  const marketId = linkedMarketId.trim();
  useEffect(() => {
    if (!marketId) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/panta/markets/${encodeURIComponent(marketId)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Lookup failed (${res.status})`);
        setFetched({ id: marketId, market: toLinked(data as PantaMarket) });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setFetched({ id: marketId, error: e instanceof Error ? e.message : "Lookup failed" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [marketId]);

  const loadingMarket = !!marketId && fetched?.id !== marketId;
  const linkedMarket = marketId && fetched?.id === marketId ? (fetched.market ?? null) : null;
  const lookupError = marketId && fetched?.id === marketId ? fetched.error : undefined;

  const conviction = linkedMarket ? calculateConviction([linkedMarket]) : null;
  const score = conviction?.score ?? 0;
  const feeBps = feeBpsForScore(score);

  function validate(): string | null {
    if (!publicKey || !signTransaction) return "Please connect your wallet first";
    if (!ready) return blockReason;
    if (!name.trim() || !symbol.trim()) return "Name and symbol are required";
    if (name.trim().length > 32) return "Token name must be 32 characters or fewer";
    if (symbol.trim().length > 10) return "Symbol must be 10 characters or fewer";
    if (marketId && !linkedMarket) return "The linked market could not be loaded. Fix the market ID or clear it.";
    if (IS_MAINNET && !isPublicHttpsUrl(window.location.origin)) {
      return "On mainnet the token metadata URL must be public HTTPS. Deploy the app (or open it via a public https URL) before launching for real.";
    }
    return null;
  }

  async function launchOnChain() {
    const v = validate();
    if (v) return setError(v);
    if (!publicKey || !signTransaction) return;

    if (
      IS_MAINNET &&
      !window.confirm(
        `MAINNET: this creates a real Meteora bonding-curve pool and spends real SOL (account rent + fees).\n\nToken: ${name.trim()} (${symbol.trim().toUpperCase()})\nTrading fee: ${(feeBps / 100).toFixed(2)}%\n\nContinue?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setStatus("Building Meteora config + pool transaction...");
      const meta = new URLSearchParams({ name: name.trim(), symbol: symbol.trim().toUpperCase() });
      if (description.trim()) meta.set("description", description.trim());
      let uri = `${window.location.origin}/api/metadata?${meta.toString()}`;
      if (uri.length > 200) {
        meta.delete("description"); // on-chain URI limit is 200 chars
        uri = `${window.location.origin}/api/metadata?${meta.toString()}`;
      }

      const prepared = await prepareLaunch(connection, {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        uri,
        feeBps,
        payer: publicKey,
      });

      setStatus("Simulating transaction on the RPC...");
      await simulateLaunch(connection, prepared.tx);

      setStatus("Simulation passed. Approve the transaction in your wallet...");
      const signature = await sendLaunch(connection, prepared, signTransaction);

      const rec: LaunchRecord = {
        mint: prepared.baseMint,
        pool: prepared.pool,
        config: prepared.config,
        signature,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim() || undefined,
        linkedMarketIds: marketId ? [marketId] : [],
        convictionScore: score,
        feeBps,
        createdAt: new Date().toISOString(),
        creator: publicKey.toBase58(),
      };
      launchStore.add(rec);
      launchStore.rememberMint(rec.mint);
      setResult(rec);
      setStatus("Token + bonding curve pool created on-chain!");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Launch failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500";

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Launch Token</h1>
        <p className="text-zinc-400 mt-2">
          Link a live prediction market. Higher conviction unlocks a lower trading fee on your Meteora
          bonding curve.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Token Name *</label>
          <input className={inputCls} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="PredictLaunch Token" disabled={busy} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Symbol *</label>
          <input className={inputCls} value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="PLT" disabled={busy} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this token about?" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Linked prediction market (optional)</label>
          <select
            className={inputCls}
            value={markets.some((m) => m.marketId === linkedMarketId) ? linkedMarketId : ""}
            onChange={(e) => setLinkedMarketId(e.target.value)}
            disabled={busy || markets.length === 0}
          >
            <option value="">{markets.length === 0 ? "Loading live markets…" : "— No market (standard fee) —"}</option>
            {markets.map((m) => (
              <option key={m.marketId} value={m.marketId}>
                {m.title.slice(0, 70)} · ${m.volumeUsdc.toLocaleString()}
              </option>
            ))}
          </select>
          <input
            className={`${inputCls} mt-2 text-sm`}
            value={linkedMarketId}
            onChange={(e) => setLinkedMarketId(e.target.value)}
            placeholder="…or paste a Panta market ID"
            disabled={busy}
          />
          {loadingMarket && <p className="text-xs text-zinc-500 mt-2">Loading market from Panta...</p>}
          {lookupError && <p className="text-xs text-red-400 mt-2 whitespace-pre-wrap wrap-break-words">{lookupError}</p>}
          {linkedMarket && <p className="text-xs text-zinc-400 mt-2 line-clamp-2">Market: {linkedMarket.question}</p>}
        </div>

        {conviction ? (
          <ConvictionPanel conviction={conviction} />
        ) : (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
            No market linked — this launch uses the standard {(feeBpsForScore(0) / 100).toFixed(2)}% base fee.
          </div>
        )}

        {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">{error}</div>}
        {status && <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">{status}</div>}

        {result && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-2">
            <p className="text-emerald-300 font-medium">Launched on-chain</p>
            <p className="text-zinc-400">
              Conviction <strong>{result.convictionScore}/100</strong> · fee <strong>{(result.feeBps / 100).toFixed(2)}%</strong>
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={`/launches/${result.mint}`} className="text-violet-300 hover:underline font-medium">
                Open token page & trade →
              </Link>
              <a className="text-zinc-400 hover:underline" href={txUrl(result.signature)} target="_blank" rel="noreferrer">
                Transaction ↗
              </a>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={launchOnChain}
          disabled={busy || !publicKey || !ready}
          className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          {busy ? "Working..." : !publicKey ? "Connect Wallet First" : !ready ? "Waiting for RPC…" : "Launch on Meteora"}
        </button>
        {publicKey && !ready && blockReason && <p className="text-xs text-red-400">{blockReason}</p>}
      </div>
    </div>
  );
}

export default function LaunchTokenPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <LaunchForm />
    </Suspense>
  );
}
