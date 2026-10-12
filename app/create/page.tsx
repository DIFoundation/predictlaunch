"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/components/network/NetworkProvider";
import { PANTA_WRITES_ENABLED } from "@/lib/config/network";
import { sendAndConfirm } from "@/lib/rpc/connection";
import { decodeTx, extractTxB64, simulateUsdcSpend, usdcBalance } from "@/lib/panta/tx";
import { USDC_DECIMALS } from "@/lib/config/network";
import { VersionedTransaction } from "@solana/web3.js";
import { parseUploadResponse, uploadToTarget } from "@/lib/panta/upload-spec";

type Quote = Record<string, unknown> & {
  createId?: string;
  paymentUsdc?: number | string;
  liquidityInjectionUsdc?: number | string;
  platformRevenueUsdc?: number | string;
  expiresAt?: string;
};

function localDateTimeValue(timestampMs: number): string {
  const date = new Date(timestampMs - new Date(timestampMs).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function usdcFromBaseUnits(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") return null;
  const raw = Number(value);
  if (!Number.isSafeInteger(raw) || raw < 0) return null;
  return raw / 10 ** USDC_DECIMALS;
}

function formatUsdc(value: number | null): string {
  return value === null ? "Not provided by Panta" : `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`;
}

// Used only if Panta's /categories/ allowlist can't be loaded.
const FALLBACK_CATEGORIES = [
  { value: "crypto", label: "Crypto" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "finance", label: "Finance" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
];

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
  const [marketType, setMarketType] = useState<"standard" | "breaking">("standard");
  const [categories, setCategories] = useState<{ value: string; label: string }[]>(FALLBACK_CATEGORIES);
  const [imageUrl, setImageUrl] = useState("");
  const [maxBudgetUsdc, setMaxBudgetUsdc] = useState("");
  const [startAt, setStartAt] = useState(() => localDateTimeValue(Date.now() + (72 * 60 + 5) * 60_000));
  const [endAt, setEndAt] = useState(() => localDateTimeValue(Date.now() + (144 * 60 + 5) * 60_000));

  const [quote, setQuote] = useState<Quote | null>(null);
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Panta enforces a category allowlist; read the real one.
  useEffect(() => {
    let alive = true;
    fetch("/api/panta/categories")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !Array.isArray(d.items) || d.items.length === 0) return;
        setCategories(d.items);
        setCategory((cur) => (d.items.some((c: { value: string }) => c.value === cur) ? cur : d.items[0].value));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Best-effort image upload (endpoint + response shape are guessed -- see lib/panta/upload-spec.ts).
  // Falls back cleanly: on any failure, the manual Image URL field above still works.
  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await postJson<{ target: unknown }>("/api/panta/upload-image", {
        filename: file.name,
        contentType: file.type || "image/png",
      });
      const target = parseUploadResponse(res.target);
      const url = await uploadToTarget(target, file);
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Step 1: ask Panta for a quote. Nothing is signed or spent yet.
  async function handleQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return setError("Please connect your wallet first");
    if (!PANTA_WRITES_ENABLED) return setError("Panta builds mainnet transactions. Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet to create markets.");
    if (!ready) return setError(blockReason);
    if (question.trim().length < 10) return setError("Question must be at least 10 characters");
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    const minStartMs = Date.now() + 72 * 60 * 60 * 1000 + 5 * 60 * 1000;
    const budget = Number(maxBudgetUsdc);
    if (!Number.isFinite(budget) || budget <= 0) return setError("Enter the maximum USDC budget you are willing to spend on market creation.");
    if (!Number.isFinite(startMs) || (marketType === "standard" && startMs < minStartMs) || (marketType === "breaking" && startMs > Date.now() + 72 * 60 * 60 * 1000)) return setError(marketType === "standard" ? "Standard markets must start at least 72 hours and 5 minutes from now." : "Breaking markets must start within the next 72 hours or already be underway.");
    if (!Number.isFinite(endMs) || endMs <= startMs) return setError("Market close time must be later than the start time.");

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
        marketType,
        startTime: Math.floor(startMs / 1000),
        endTime: Math.floor(endMs / 1000),
      });
      if (!q.createId) throw new Error("No createId in quote response: " + JSON.stringify(q));
      const quotedPayment = usdcFromBaseUnits(q.paymentUsdc);
      if (quotedPayment === null) throw new Error("Panta quote did not include a valid paymentUsdc amount in USDC base units.");
      if (quotedPayment > budget) {
        throw new Error(`Panta's current creation quote is ${formatUsdc(quotedPayment)}, above your ${formatUsdc(budget)} maximum budget. No transaction was built or signed. Increase your budget only if you accept the amount, or cancel and check whether Panta supports a lower-cost market configuration.`);
      }
      try {
        setWalletUsdcBalance(await usdcBalance(connection, publicKey));
      } catch {
        setWalletUsdcBalance(null);
      }
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
    const expiryMs = typeof quote.expiresAt === "string" ? Date.parse(quote.expiresAt) : NaN;
    if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
      setQuote(null);
      setError("This Panta quote has expired. Request a fresh quote before building or signing a transaction.");
      setStatus(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const quotedPaymentBeforeBuild = usdcFromBaseUnits(quote.paymentUsdc);
      if (quotedPaymentBeforeBuild === null) throw new Error("The quote does not contain a valid USDC payment amount. Request a new quote.");
      const balanceBeforeBuild = await usdcBalance(connection, publicKey);
      setWalletUsdcBalance(balanceBeforeBuild);
      if (balanceBeforeBuild < quotedPaymentBeforeBuild) {
        const shortfall = quotedPaymentBeforeBuild - balanceBeforeBuild;
        throw new Error(`Insufficient USDC before transaction building: Panta requires ${formatUsdc(quotedPaymentBeforeBuild)}, your wallet has ${formatUsdc(balanceBeforeBuild)}, and you are short ${formatUsdc(shortfall)}. Fund this wallet with at least ${formatUsdc(shortfall)} more USDC, then request a fresh quote. SOL for network fees is separate.`);
      }
      setStatus("Building transaction...");
      const build = await postJson<Record<string, unknown>>("/api/panta/build", { createId });
      const b64 = extractTxB64(build);
      if (!b64) {
        throw new Error("Build response had no transaction. Keys: " + Object.keys(build).join(", "));
      }

      // Deserialize first; Panta's create transaction must pass the same RPC simulation
      // gate used by Meteora before we ask the wallet to sign.
      const tx = decodeTx(b64);
      const lastValidBlockHeight =
        typeof build.lastValidBlockHeight === "number" ? build.lastValidBlockHeight : undefined;
      if (tx instanceof VersionedTransaction) {
        if (!tx.message.recentBlockhash) throw new Error("Panta create transaction has no recent blockhash.");
        const feePayer = tx.message.staticAccountKeys[0];
        if (!feePayer || !feePayer.equals(publicKey)) {
          throw new Error("Panta create transaction fee payer does not match the connected wallet. Refusing to sign.");
        }
      } else {
        if (!tx.feePayer) tx.feePayer = publicKey;
        if (!tx.recentBlockhash) throw new Error("Panta create transaction has no recent blockhash.");
        if (!tx.feePayer.equals(publicKey)) throw new Error("Panta create transaction fee payer does not match the connected wallet. Refusing to sign.");
      }
      const simulationTx = tx instanceof VersionedTransaction ? tx : new VersionedTransaction(tx.compileMessage());
      const [balance, feeResult, tokenBalance] = await Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection.getFeeForMessage(simulationTx.message, "confirmed"),
        usdcBalance(connection, publicKey),
      ]);
      const quotedPayment = usdcFromBaseUnits(quote.paymentUsdc);
      if (quotedPayment === null) throw new Error("The quote does not contain a valid USDC payment amount. Request a new quote.");
      if (tokenBalance < quotedPayment) {
        throw new Error(`Insufficient USDC for market creation. Panta quoted ${formatUsdc(quotedPayment)}, but this wallet has ${formatUsdc(tokenBalance)}. The transaction has not been signed. Set a maximum budget you are comfortable with and only proceed when the wallet has enough USDC.`);
      }
      if (balance <= 0 || feeResult.value === null || balance < feeResult.value) {
        throw new Error(`This wallet cannot pay the market-creation transaction fee on the configured RPC (SOL balance: ${(balance / 1e9).toFixed(6)} SOL; estimated network fee: ${feeResult.value === null ? "unavailable" : (feeResult.value / 1e9).toFixed(6) + " SOL"}). Confirm that the app and wallet are both on Solana mainnet and fund this wallet with SOL before creating a market.`);
      }
      setStatus("Simulating Panta market creation and measuring the actual USDC spend...");
      const sim = await simulateUsdcSpend(connection, tx, publicKey);
      if (!sim.simulated) {
        throw new Error(`${sim.error ?? "Market transaction simulation failed."}${sim.logs?.length ? "\\n" + sim.logs.join("\\n") : ""}`);
      }
      if (sim.spentUsdc === null || sim.spentUsdc <= 0) {
        throw new Error("Could not verify the USDC amount this transaction will spend. Refusing to ask the wallet to sign.");
      }
      const spendTolerance = Math.max(0.01, quotedPayment * 0.005);
      if (sim.spentUsdc > quotedPayment + spendTolerance) {
        throw new Error(`Safety check blocked signing: Panta's quote is ${formatUsdc(quotedPayment)}, but simulation indicates a spend of ${formatUsdc(sim.spentUsdc)}. No transaction was signed.`);
      }

      setStatus("Simulation passed. Approve the transaction in your wallet...");
      const signed = await signTransaction(tx);

      setStatus("Broadcasting and confirming...");
      const signature = await sendAndConfirm(connection, signed, lastValidBlockHeight);

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
    "w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create Market</h1>
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
        Market creation uses real mainnet USDC and SOL for network fees. Panta\u2019s published creation fees are $50 USDC for Standard and $20 USDC for Breaking. A $10 budget cannot cover either type. The live Panta quote remains authoritative and your maximum budget is enforced before building or signing.
      </div>

      <form onSubmit={handleQuote} className="space-y-5 rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 sm:p-6">
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
          <label className="block text-sm font-medium mb-2">Market type *</label>
          <select
            className={inputCls}
            value={marketType}
            onChange={(e) => {
              const next = e.target.value as "standard" | "breaking";
              setMarketType(next);
              const now = Date.now();
              setStartAt(localDateTimeValue(next === "standard" ? now + (72 * 60 + 5) * 60_000 : now + 60 * 60_000));
              setEndAt(localDateTimeValue(next === "standard" ? now + (144 * 60 + 5) * 60_000 : now + 25 * 60 * 60_000));
              setQuote(null);
              setError(null);
            }}
            disabled={busy || !!quote}
          >
            <option value="standard">Standard — $50 USDC · starts 72+ hours ahead</option>
            <option value="breaking">Breaking — $20 USDC · starts within 72 hours or already underway</option>
          </select>
          <p className="mt-1.5 text-xs text-zinc-500">Panta determines the actual fee. These are its published fee levels; the live quote remains authoritative.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy || !!quote}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Market starts (local time) *</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={startAt}
              min={marketType === "standard" ? localDateTimeValue(Date.now() + 72 * 60 * 60 * 1000 + 5 * 60 * 1000) : undefined}
              onChange={(e) => setStartAt(e.target.value)}
              disabled={busy || !!quote}
              required
            />
            <p className="mt-1.5 text-xs text-zinc-500">{marketType === "standard" ? "Standard: at least 72 hours and 5 minutes' notice." : "Breaking: event starts within 72 hours or may already be underway."}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Market closes (local time) *</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={endAt}
              min={startAt}
              onChange={(e) => setEndAt(e.target.value)}
              disabled={busy || !!quote}
              required
            />
            <p className="mt-1.5 text-xs text-zinc-500">Resolution timing follows Panta's current rules.</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Maximum creation budget (USDC) *</label>
          <input
            className={inputCls}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={maxBudgetUsdc}
            onChange={(e) => setMaxBudgetUsdc(e.target.value)}
            placeholder="Enter the most you are willing to spend"
            disabled={busy || !!quote}
            required
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            This is your spending limit, not a promise that Panta supports that exact creation price. We request Panta's live quote and block it if the quoted payment exceeds your limit.
          </p>
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
          <div className="mt-2 flex items-center gap-3">
            <label className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 cursor-pointer transition text-zinc-300">
              {uploading ? "Uploading…" : "Or upload an image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy || uploading || !!quote}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-xs text-zinc-600">beta, unverified against Panta&apos;s real API</span>
          </div>
          {uploadError && <p className="text-xs text-red-400 mt-1.5 whitespace-pre-wrap break-words">{uploadError}</p>}
        </div>

        {!quote && (
          <button
            type="submit"
            disabled={busy || !publicKey || !PANTA_WRITES_ENABLED || !ready}
            className="w-full rounded-xl bg-emerald-300 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working..." : publicKey ? "Get Quote" : "Connect Wallet First"}
          </button>
        )}
      </form>

      {quote && (
        <div className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5">
          <div>
            <p className="text-sm text-zinc-400">Panta quote · actual required payment</p>
            <p className="text-2xl font-bold mt-1">{formatUsdc(usdcFromBaseUnits(quote.paymentUsdc))}</p>
            <p className="mt-1 text-xs text-zinc-500">Your maximum budget: {formatUsdc(Number.isFinite(Number(maxBudgetUsdc)) && Number(maxBudgetUsdc) > 0 ? Number(maxBudgetUsdc) : null)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm space-y-2">
            <div className="flex justify-between gap-3"><span className="text-zinc-400">Required USDC</span><strong>{formatUsdc(usdcFromBaseUnits(quote.paymentUsdc))}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">Wallet USDC balance</span><strong>{walletUsdcBalance === null ? "Checking before build" : formatUsdc(walletUsdcBalance)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">USDC shortfall</span><strong className={walletUsdcBalance !== null && (usdcFromBaseUnits(quote.paymentUsdc) ?? 0) > walletUsdcBalance ? "text-red-400" : "text-emerald-300"}>{walletUsdcBalance === null ? "Checked before build" : formatUsdc(Math.max(0, (usdcFromBaseUnits(quote.paymentUsdc) ?? 0) - walletUsdcBalance))}</strong></div>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-zinc-500">Seed liquidity</p><p className="mt-1 font-medium">{formatUsdc(usdcFromBaseUnits(quote.liquidityInjectionUsdc))}</p></div>
            <div><p className="text-xs text-zinc-500">Platform revenue</p><p className="mt-1 font-medium">{formatUsdc(usdcFromBaseUnits(quote.platformRevenueUsdc))}</p></div>
            <div><p className="text-xs text-zinc-500">Quote expires</p><p className="mt-1 font-medium">{typeof quote.expiresAt === "string" ? new Date(quote.expiresAt).toLocaleString() : "As specified by Panta"}</p></div>
          </div>
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer">Raw quote response</summary>
            <pre className="mt-2 overflow-x-auto">{JSON.stringify(quote, null, 2)}</pre>
          </details>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="rounded-xl bg-emerald-300 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-50"
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
              className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
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
