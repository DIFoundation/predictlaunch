"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/components/network/NetworkProvider";
import { PANTA_WRITES_ENABLED } from "@/lib/config/network";
import { sendAndConfirm } from "@/lib/rpc/connection";

type Quote = Record<string, unknown> & { createId?: string; paymentUsdc?: number | string };

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Panta returns a base64 serialized tx; the field name isn't documented in our notes, so be tolerant. */
function extractTx(build: Record<string, unknown>): string | null {
  for (const k of ["transaction", "tx", "serializedTransaction", "txBase64", "transactionBase64"]) {
    if (typeof build[k] === "string" && (build[k] as string).length > 100) return build[k] as string;
  }
  return null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export default function CreateMarketPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const { ready, blockReason } = useNetwork();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("crypto");
  const [imageUrl, setImageUrl] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: ask Panta for a quote. Nothing is signed or spent yet.
  async function handleQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return setError("Please connect your wallet first");
    if (!PANTA_WRITES_ENABLED) return setError("Panta builds mainnet transactions. Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet to create markets.");
    if (!ready) return setError(blockReason);
    if (question.trim().length < 10) return setError("Question must be at least 10 characters");

    setBusy(true);
    setError(null);
    setQuote(null);
    setStatus("Requesting quote from Panta...");
    try {
      const q = await postJson<Quote>("/api/panta/quote", {
        wallet: publicKey.toBase58(),
        question,
        description,
        category,
        imageUrl: imageUrl.trim() || undefined,
      });
      if (!q.createId) throw new Error("No createId in quote response: " + JSON.stringify(q));
      setQuote(q);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  // Step 2: user reviewed the fee -> build, sign, broadcast, register.
  async function handleConfirm() {
    if (!quote?.createId || !publicKey || !signTransaction) return;
    const createId = quote.createId;

    setBusy(true);
    setError(null);
    try {
      setStatus("Building transaction...");
      const build = await postJson<Record<string, unknown>>("/api/panta/build", { createId });
      const b64 = extractTx(build);
      if (!b64) {
        throw new Error("Build response had no transaction. Keys: " + Object.keys(build).join(", "));
      }

      // Deserialize FIRST, sign second. (The old code wrapped both in one try/catch, so a
      // wallet "User rejected" error fell through to the legacy path and got masked.)
      const bytes = base64ToBytes(b64);
      let tx: VersionedTransaction | Transaction;
      try {
        tx = VersionedTransaction.deserialize(bytes);
      } catch {
        tx = Transaction.from(bytes);
      }

      setStatus("Approve the transaction in your wallet...");
      const signed = await signTransaction(tx);

      setStatus("Broadcasting and confirming...");
      const signature = await sendAndConfirm(connection, signed);

      setStatus("Registering market with Panta...");
      await postJson("/api/panta/register", { createId, signature });

      setStatus("Market created!");
      setTimeout(() => router.push("/markets"), 1500);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create market");
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
        <h1 className="text-3xl font-bold">Create Market</h1>
        <p className="text-zinc-400 mt-2">
          Create a prediction market · <span className="text-zinc-300">Powered by Panta</span>
        </p>
      </div>

      {!PANTA_WRITES_ENABLED && (
        <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-200 text-sm">
          The app is on <b>devnet</b>. Panta builds mainnet transactions, so creating markets is only
          available when <code>NEXT_PUBLIC_SOLANA_NETWORK=mainnet</code>.
        </div>
      )}

      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
        Creating a market on Panta costs real USDC (platform fee + seed liquidity). You will see the
        exact fee from Panta and must confirm before anything is signed.
      </div>

      <form onSubmit={handleQuote} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Question *</label>
          <input
            className={inputCls}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will $SOL reach $300 before December 2026?"
            disabled={busy || !!quote}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            className={inputCls}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more context..."
            disabled={busy || !!quote}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy || !!quote}
          >
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
            <option value="finance">Finance</option>
            <option value="entertainment">Entertainment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Image URL (optional)</label>
          <input
            className={inputCls}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Public https image (leave blank for the default)"
            disabled={busy || !!quote}
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Panta rejects many image hosts at build time. If build fails with a generic error, try a
            different image URL.
          </p>
        </div>

        {!quote && (
          <button
            type="submit"
            disabled={busy || !publicKey || !PANTA_WRITES_ENABLED || !ready}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {busy ? "Working..." : publicKey ? "Get Quote" : "Connect Wallet First"}
          </button>
        )}
      </form>

      {quote && (
        <div className="p-5 rounded-xl border border-zinc-700 bg-zinc-900/60 space-y-4">
          <div>
            <p className="text-sm text-zinc-400">Panta quote</p>
            <p className="text-2xl font-bold mt-1">
              {quote.paymentUsdc !== undefined ? `${quote.paymentUsdc} USDC` : "See details below"}
            </p>
          </div>
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer">Raw quote response</summary>
            <pre className="mt-2 overflow-x-auto">{JSON.stringify(quote, null, 2)}</pre>
          </details>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 font-medium transition"
            >
              {busy ? "Working..." : "Confirm & Sign"}
            </button>
            <button
              onClick={() => {
                setQuote(null);
                setStatus(null);
                setError(null);
              }}
              disabled={busy}
              className="py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">
          {error}
        </div>
      )}
      {status && (
        <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">
          {status}
        </div>
      )}
    </div>
  );
}
