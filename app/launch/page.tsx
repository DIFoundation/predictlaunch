"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { calculateConviction } from "@/lib/conviction/score";
import { launchStore } from "@/lib/conviction/store";
import { LinkedMarket, LaunchRecord } from "@/types/conviction";

export default function LaunchTokenPage() {
  const { publicKey } = useWallet();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMarketId, setLinkedMarketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; score: number } | null>(null);

  // Mock linked market data for the MVP (later we fetch real data from Panta)
  const [linkedMarket, setLinkedMarket] = useState<LinkedMarket | null>(null);
  const [conviction, setConviction] = useState<ReturnType<typeof calculateConviction> | null>(null);

  // When user types a market ID, simulate loading market data
  useEffect(() => {
    if (!linkedMarketId.trim()) {
      setLinkedMarket(null);
      setConviction(null);
      return;
    }

    // Mock data – in real version we would call Panta
    const mock: LinkedMarket = {
      marketId: linkedMarketId.trim(),
      question: "Will this token reach significant traction?",
      volumeUsdc: 1850,
      yesPrice: 0.68,
      uniqueTraders: 42,
      status: "open",
    };

    setLinkedMarket(mock);
    setConviction(calculateConviction([mock]));
  }, [linkedMarketId]);

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();

    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    if (!name.trim() || !symbol.trim()) {
      setError("Name and symbol are required");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus("Creating launch record and calculating conviction...");

    try {
      // Simulate a short delay
      await new Promise((r) => setTimeout(r, 800));

      const scoreResult = conviction || calculateConviction([]);

      const newLaunch: LaunchRecord = {
        id: `launch_${Date.now()}`,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim() || undefined,
        linkedMarketIds: linkedMarketId.trim() ? [linkedMarketId.trim()] : [],
        convictionScore: scoreResult.score,
        createdAt: new Date().toISOString(),
        creator: publicKey.toBase58(),
      };

      // Save to our simple store
      launchStore.add(newLaunch);

      setStatus("Launch created successfully (MVP mode)");
      setResult({
        id: newLaunch.id,
        score: scoreResult.score,
      });
    } catch (err: any) {
      setError(err.message || "Failed to create launch");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <Link href="/launches" className="text-sm text-zinc-400 hover:text-white">
          ← Back to Launches
        </Link>
        <h1 className="text-3xl font-bold mt-4">Launch Token</h1>
        <p className="text-zinc-400 mt-2">
          Create a launch and optionally link a prediction market for conviction
        </p>
      </div>

      <form onSubmit={handleLaunch} className="space-y-6">
        {/* Token details */}
        <div>
          <label className="block text-sm font-medium mb-2">Token Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="PredictLaunch Token"
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Symbol *</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="PLT"
            maxLength={10}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this token about?"
            rows={3}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
        </div>

        {/* Link a market */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Linked Market ID (optional)
          </label>
          <input
            type="text"
            value={linkedMarketId}
            onChange={(e) => setLinkedMarketId(e.target.value)}
            placeholder="Paste a Panta market ID"
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Linking a market enables the conviction score and unlocks better launch parameters.
          </p>
        </div>

        {/* Live Conviction Panel */}
        {conviction && (
          <div className="p-5 rounded-xl border border-zinc-700 bg-zinc-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Conviction Score</h3>
              <span
                className={`text-sm font-semibold px-2.5 py-1 rounded-full ${conviction.level === "Very High"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : conviction.level === "High"
                      ? "bg-violet-500/20 text-violet-400"
                      : conviction.level === "Medium"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-zinc-700 text-zinc-400"
                  }`}
              >
                {conviction.level} · {conviction.score}/100
              </span>
            </div>

            <ul className="text-sm text-zinc-400 space-y-1">
              {conviction.reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>

            {/* Live Conviction Panel – improved */}
            {conviction && (
              <div className="rounded-xl border border-zinc-700 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Conviction Score</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Based on linked prediction market activity
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tracking-tight">
                      {conviction.score}
                      <span className="text-base text-zinc-500 font-normal">/100</span>
                    </div>
                    <div
                      className={`text-xs font-medium mt-0.5 ${conviction.level === "Very High"
                          ? "text-emerald-400"
                          : conviction.level === "High"
                            ? "text-violet-400"
                            : conviction.level === "Medium"
                              ? "text-amber-400"
                              : "text-zinc-400"
                        }`}
                    >
                      {conviction.level}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 bg-zinc-900/40">
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${conviction.score >= 75
                          ? "bg-emerald-500"
                          : conviction.score >= 55
                            ? "bg-violet-500"
                            : conviction.score >= 30
                              ? "bg-amber-500"
                              : "bg-zinc-600"
                        }`}
                      style={{ width: `${conviction.score}%` }}
                    />
                  </div>

                  {/* Reasons */}
                  <ul className="text-sm text-zinc-400 space-y-1.5">
                    {conviction.reasons.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Benefits */}
                  {conviction.unlockedBenefits.length > 0 && (
                    <div className="pt-3 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-2">Unlocked benefits</p>
                      <div className="flex flex-wrap gap-2">
                        {conviction.unlockedBenefits.map((b, i) => (
                          <span
                            key={i}
                            className="text-xs px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/20"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {status && (
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">
            {status}
          </div>
        )}

        {result && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-1">
            <p className="text-emerald-300 font-medium">Launch created</p>
            <p className="text-zinc-400">
              ID: <code>{result.id}</code>
            </p>
            <p className="text-zinc-400">
              Conviction Score: <strong>{result.score}/100</strong>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !publicKey}
          className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          {loading ? "Creating..." : publicKey ? "Create Launch" : "Connect Wallet First"}
        </button>
      </form>
    </div>
  );
}