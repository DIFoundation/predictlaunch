"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { useRouter } from "next/navigation";

export default function CreateMarketPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("crypto");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateMarket(e: React.FormEvent) {
    e.preventDefault();

    if (!publicKey || !signTransaction) {
      setError("Please connect your wallet first");
      return;
    }

    if (!question.trim()) {
      setError("Question is required");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Quoting market...");

    try {
      // Timestamps (Unix seconds)
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3700;          // at least 1 hour from now
      const endTime = startTime + 3 * 24 * 3600; // 3 days later
      const resolutionTime = endTime + 7200;     // 2 hours after end

      const payload = {
        wallet: publicKey.toBase58(),
        question: question.trim(),
        title: question.trim().slice(0, 100),
        description: description.trim() || "Created via PredictLaunch",
        resolutionRule: "Resolved based on publicly available information from official sources and reputable media.",
        sourcesOfTruth: [
          "https://www.coingecko.com",
          "https://www.google.com"
        ],
        category: category,
        startTime,
        endTime,
        resolutionTime,
        marketType: "standard",
        imageUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        region: "Global",
      };

      console.log("Sending quote payload:", payload);

      // 1. Quote
      const quoteRes = await fetch("/api/panta/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const quote = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quote.error || JSON.stringify(quote));

      const createId = quote.createId;
      if (!createId) throw new Error("No createId returned from quote");

      setStatus("Building transaction...");

      // 2. Build
      const buildRes = await fetch("/api/panta/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createId }),
      });

      const buildResult = await buildRes.json();
      if (!buildRes.ok) throw new Error(buildResult.error || "Build failed");

      const serializedTx = buildResult.transaction;

      if (!serializedTx) {
        throw new Error("No transaction returned from build. Full response: " + JSON.stringify(buildResult));
      }

      setStatus("Please approve the transaction in your wallet...");

      // 3. Sign (support both legacy and versioned)
      let signedTx;
      try {
        const tx = VersionedTransaction.deserialize(Buffer.from(serializedTx, "base64"));
        signedTx = await signTransaction(tx as any);
      } catch {
        const tx = Transaction.from(Buffer.from(serializedTx, "base64"));
        signedTx = await signTransaction(tx);
      }

      setStatus("Broadcasting transaction...");

      // 4. Broadcast
      const signature = await connection.sendRawTransaction(
        (signedTx as any).serialize()
      );
      await connection.confirmTransaction(signature, "confirmed");

      setStatus("Registering market...");

      // 5. Register
      const registerRes = await fetch("/api/panta/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createId, signature }),
      });

      const registerResult = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerResult.error || "Register failed");
      }

      setStatus("Market created successfully!");
      setTimeout(() => router.push("/markets"), 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create market");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Create Market</h1>
        <p className="text-zinc-400 mt-2">
          Create a prediction market powered by Panta
        </p>
      </div>

      <form onSubmit={handleCreateMarket} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Question *</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will $SOL reach $300 before December 2026?"
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more context..."
            rows={3}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-violet-500"
            disabled={loading}
          >
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
            <option value="finance">Finance</option>
            <option value="entertainment">Entertainment</option>
            <option value="other">Other</option>
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        {status && (
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !publicKey}
          className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          {loading ? "Creating..." : publicKey ? "Create Market" : "Connect Wallet First"}
        </button>
      </form>
    </div>
  );
}