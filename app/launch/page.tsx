"use client";

import { Suspense, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { calculateConviction, feeBpsForScore } from "@/lib/conviction/score";
import { launchStore } from "@/lib/conviction/store";
import { ConvictionPanel } from "@/components/conviction/ConvictionPanel";
import { detectCluster } from "@/lib/rpc/connection";
import { prepareLaunch, simulateLaunch, sendLaunch } from "@/lib/meteora/client";
import type { LinkedMarket, LaunchRecord } from "@/types/conviction";
import type { PantaMarket } from "@/types/panta";

const DEMO_MARKET: LinkedMarket = {
  marketId: "demo",
  question: "Demo market (illustrative numbers)",
  volumeUsdc: 1850,
  yesPrice: 0.68,
};

type Fetched = { id: string; market?: LinkedMarket; error?: string };

function LaunchForm() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMarketId, setLinkedMarketId] = useState(searchParams.get("market") ?? "");
  const [useDemo, setUseDemo] = useState(false);

  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [cluster, setCluster] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchRecord | null>(null);

  // Which network is the RPC endpoint really on? (devnet vs mainnet matters: real SOL.)
  useEffect(() => {
    let alive = true;
    detectCluster(connection).then((c) => alive && setCluster(c));
    return () => {
      alive = false;
    };
  }, [connection]);

  // Load the REAL linked market from Panta (debounced). No synchronous setState in the effect body.
  const marketId = linkedMarketId.trim();
  useEffect(() => {
    if (!marketId || useDemo) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/panta/markets/${encodeURIComponent(marketId)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Lookup failed (${res.status})`);
        const m = data as PantaMarket;
        setFetched({
          id: marketId,
          market: {
            marketId: m.marketId,
            question: m.title,
            volumeUsdc: m.volumeUsdc,
            yesPrice: m.yesPrice,
          },
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setFetched({ id: marketId, error: e instanceof Error ? e.message : "Lookup failed" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [marketId, useDemo]);

  const loadingMarket = !useDemo && !!marketId && fetched?.id !== marketId;
  const linkedMarket: LinkedMarket | null = useDemo
    ? DEMO_MARKET
    : marketId && fetched?.id === marketId
      ? (fetched.market ?? null)
      : null;
  const lookupError = !useDemo && marketId && fetched?.id === marketId ? fetched.error : undefined;

  const conviction = linkedMarket ? calculateConviction([linkedMarket]) : null;
  const score = conviction?.score ?? 0;
  const feeBps = feeBpsForScore(score);

  function validate(): string | null {
    if (!publicKey) return "Please connect your wallet first";
    if (!name.trim() || !symbol.trim()) return "Name and symbol are required";
    if (name.trim().length > 32) return "Token name must be 32 characters or fewer";
    if (symbol.trim().length > 10) return "Symbol must be 10 characters or fewer";
    return null;
  }

  function buildRecord(extra: Partial<LaunchRecord>): LaunchRecord {
    return {
      id: `launch_${Date.now()}`,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      description: description.trim() || undefined,
      linkedMarketIds: marketId && !useDemo ? [marketId] : [],
      convictionScore: score,
      feeBps,
      mode: "record",
      createdAt: new Date().toISOString(),
      creator: publicKey!.toBase58(),
      ...extra,
    };
  }

  function saveRecordOnly() {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    const rec = buildRecord({ mode: "record" });
    launchStore.add(rec);
    setResult(rec);
    setStatus("Launch record saved (no on-chain pool created).");
  }

  async function launchOnChain() {
    const v = validate();
    if (v) return setError(v);
    if (!signTransaction || !publicKey) return setError("Wallet cannot sign transactions");

    if (
      cluster === "mainnet-beta" &&
      !window.confirm(
        "Your RPC is on MAINNET. This creates a real Meteora pool and spends real SOL (rent + fees). Continue?"
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

      const rec = buildRecord({ mode: "onchain", mint: prepared.baseMint, signature });
      launchStore.add(rec);
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

  const explorerSuffix = cluster && cluster !== "mainnet-beta" && cluster !== "unknown" ? `?cluster=${cluster}` : "";
  const inputCls =
    "w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500";

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <Link href="/launches" className="text-sm text-zinc-400 hover:text-white">
          ← Back to Launches
        </Link>
        <h1 className="text-3xl font-bold mt-4">Launch Token</h1>
        <p className="text-zinc-400 mt-2">
          Link a prediction market. Higher conviction unlocks a lower trading fee on your Meteora
          bonding curve.
        </p>
        {cluster && (
          <p
            className={`inline-block mt-3 text-xs px-2.5 py-1 rounded-full border ${
              cluster === "mainnet-beta"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            Network: {cluster}
            {cluster === "mainnet-beta" ? " — real SOL" : ""}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Token Name *</label>
          <input
            className={inputCls}
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            placeholder="PredictLaunch Token"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Symbol *</label>
          <input
            className={inputCls}
            value={symbol}
            maxLength={10}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="PLT"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            className={inputCls}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this token about?"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Linked Market ID (optional)</label>
          <input
            className={inputCls}
            value={linkedMarketId}
            onChange={(e) => setLinkedMarketId(e.target.value)}
            placeholder="Paste a Panta market ID (or pick one from Markets)"
            disabled={busy || useDemo}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
            <Link href="/markets" className="hover:text-zinc-300 underline underline-offset-2">
              Browse markets →
            </Link>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDemo}
                onChange={(e) => setUseDemo(e.target.checked)}
                disabled={busy}
              />
              Use demo market data
            </label>
          </div>
          {loadingMarket && <p className="text-xs text-zinc-500 mt-2">Loading market from Panta...</p>}
          {lookupError && (
            <p className="text-xs text-red-400 mt-2 whitespace-pre-wrap break-words">{lookupError}</p>
          )}
          {linkedMarket && !useDemo && (
            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">Market: {linkedMarket.question}</p>
          )}
        </div>

        {conviction ? (
          <ConvictionPanel conviction={conviction} isDemo={useDemo} />
        ) : (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
            No market linked — this launch uses the standard {(feeBpsForScore(0) / 100).toFixed(2)}%
            base fee.
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap break-words">
            {error}
          </div>
        )}
        {status && (
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">
            {status}
          </div>
        )}

        {result && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-1.5">
            <p className="text-emerald-300 font-medium">
              {result.mode === "onchain" ? "Launched on-chain" : "Launch record saved"}
            </p>
            <p className="text-zinc-400">
              Conviction: <strong>{result.convictionScore}/100</strong> · fee{" "}
              <strong>{((result.feeBps ?? 0) / 100).toFixed(2)}%</strong>
            </p>
            {result.mint && (
              <p className="text-zinc-400 break-all">
                Mint:{" "}
                <a
                  className="text-violet-400 hover:underline"
                  href={`https://solscan.io/token/${result.mint}${explorerSuffix}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.mint}
                </a>
              </p>
            )}
            {result.signature && (
              <p className="text-zinc-400 break-all">
                Tx:{" "}
                <a
                  className="text-violet-400 hover:underline"
                  href={`https://solscan.io/tx/${result.signature}${explorerSuffix}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.signature.slice(0, 20)}…
                </a>
              </p>
            )}
            <Link href="/launches" className="inline-block text-violet-400 hover:underline">
              View all launches →
            </Link>
          </div>
        )}

        <div className="grid gap-3">
          <button
            type="button"
            onClick={launchOnChain}
            disabled={busy || !publicKey}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {busy ? "Working..." : publicKey ? "Launch on Meteora (on-chain)" : "Connect Wallet First"}
          </button>
          <button
            type="button"
            onClick={saveRecordOnly}
            disabled={busy || !publicKey}
            className="w-full py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-zinc-300 transition"
          >
            Save launch record only (no on-chain pool)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LaunchTokenPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <LaunchForm />
    </Suspense>
  );
}
