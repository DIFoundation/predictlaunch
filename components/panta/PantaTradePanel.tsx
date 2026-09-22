"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { PANTA_WRITES_ENABLED, txUrl } from "@/lib/config/network";
import { sendAndConfirm } from "@/lib/rpc/connection";
import { checkSpend, decodeTx, extractTxB64, simulateUsdcSpend, usdcBalance } from "@/lib/panta/tx";
import type { Side } from "@/lib/panta/trade-spec";

interface Props {
  marketId: string;
  title: string;
  phase: string;
  yesPrice: number | null;
  noPrice: number | null;
}

type Json = Record<string, unknown>;

async function postJson<T = Json>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

/** Pull a few headline numbers out of the quote if present (field names are not in Panta's schema). */
function headline(quote: Json) {
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = quote[k];
      if (v !== undefined && v !== null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  return {
    shares: pick(["shares", "sharesOut", "estimatedShares", "fillShares", "outShares"]),
    price: pick(["avgPrice", "averagePrice", "fillPrice", "price"]),
    fee: pick(["feeUsdc", "fee"]),
  };
}

export function PantaTradePanel({ marketId, title, phase, yesPrice, noPrice }: Props) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();
  const router = useRouter();

  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Json | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [done, setDone] = useState<{ signature: string; attribution: string } | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !ready) return;
    try {
      setBalance(await usdcBalance(connection, publicKey));
    } catch {
      /* informational */
    }
  }, [connection, publicKey, ready]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await refreshBalance();
    })();
    return () => {
      alive = false;
    };
  }, [refreshBalance]);

  const secondary = /secondary/i.test(phase);
  const amountNum = Number(amount);
  const price = side === "yes" ? yesPrice : noPrice;

  function reset() {
    setQuote(null);
    setVerified(null);
    setError(null);
    setStatus(null);
  }

  async function getQuote() {
    reset();
    setDone(null);
    if (!publicKey) return setError("Connect your wallet first");
    if (!ready) return setError(blockReason);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError("Enter an amount in USDC");
    setBusy(true);
    setStatus("Getting a quote from Panta...");
    try {
      const q = await postJson("/api/panta/trade/quote", {
        wallet: publicKey.toBase58(),
        marketId,
        side,
        amountUsdc: amountNum,
      });
      if (typeof q.quoteId !== "string") {
        throw new Error("Panta's quote had no quoteId: " + JSON.stringify(q).slice(0, 300));
      }
      setQuote(q);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBuy() {
    if (!quote || !publicKey || !signTransaction) return;
    const quoteId = quote.quoteId as string;

    if (
      !window.confirm(
        `MAINNET: buy ${side.toUpperCase()} for ${amountNum} USDC?\n\n"${title.slice(0, 120)}"\n\nThis spends real USDC.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setStatus("Building the transaction...");
      const build = await postJson("/api/panta/trade/build", { quoteId, wallet: publicKey.toBase58() });
      const b64 = extractTxB64(build);
      if (!b64) throw new Error("Panta's build response had no transaction. Keys: " + Object.keys(build).join(", "));
      const tx = decodeTx(b64);

      // Safety net: measure what this transaction REALLY does to our USDC before signing.
      setStatus("Checking what this transaction does (simulation)...");
      const sim = await simulateUsdcSpend(connection, tx, publicKey);
      if (!sim.simulated) throw new Error(`${sim.error}\n${(sim.logs ?? []).join("\n")}`);
      const gate = checkSpend(sim.spentUsdc, amountNum);
      if (gate.ok === false) throw new Error(gate.reason);
      if (gate.ok === "unverified") {
        if (!window.confirm(`${gate.reason}\n\nThe transaction will still be shown in your wallet. Continue?`)) {
          setStatus(null);
          setBusy(false);
          return;
        }
      } else {
        setVerified(gate.note);
      }

      setStatus("Approve the transaction in your wallet...");
      const signed = await signTransaction(tx);

      setStatus("Broadcasting and confirming...");
      const signature = await sendAndConfirm(connection, signed);

      setStatus("Registering your order with Panta...");
      const res = await postJson<{ attribution?: { ok: boolean; error?: string } }>("/api/panta/trade/submit", {
        quoteId,
        signature,
        wallet: publicKey.toBase58(),
        marketId,
      });

      // Best-effort status check (Panta finalises asynchronously).
      for (let i = 0; i < 4; i++) {
        try {
          await postJson("/api/panta/trade/verify", { quoteId, signature });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setDone({
        signature,
        attribution: res.attribution?.ok
          ? "Trade attributed to PredictLaunch."
          : `Attribution pending/failed: ${(res.attribution?.error ?? "").slice(0, 160)}`,
      });
      setStatus("Order placed!");
      setQuote(null);
      setAmount("");
      await refreshBalance();
      router.refresh();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Order failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const h = quote ? headline(quote) : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
        <h2 className="font-semibold">Trade</h2>
        <span className="text-xs text-zinc-500">Powered by Panta</span>
      </div>

      <div className="p-5 space-y-4">
        {!PANTA_WRITES_ENABLED && (
          <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-200 text-sm">
            Panta trades on Solana mainnet. Set <code>NEXT_PUBLIC_SOLANA_NETWORK=mainnet</code> to trade here.
          </div>
        )}
        {secondary && (
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700 text-zinc-300 text-sm">
            This market has moved to Panta&apos;s secondary (order-book) phase. Panta&apos;s API only exposes primary-market buys, so it
            can&apos;t be traded from here.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {(["yes", "no"] as Side[]).map((s) => {
            const p = s === "yes" ? yesPrice : noPrice;
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setSide(s);
                  reset();
                }}
                className={`p-3 rounded-lg border text-center transition ${
                  active
                    ? s === "yes"
                      ? "border-emerald-500 bg-emerald-600/20"
                      : "border-rose-500 bg-rose-600/20"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                <p className={`text-xs ${s === "yes" ? "text-emerald-300" : "text-rose-300"}`}>{s.toUpperCase()}</p>
                <p className="text-xl font-bold mt-1">{p === null ? "—" : `${Math.round(p * 100)}¢`}</p>
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <span>Amount (USDC)</span>
            <button type="button" className="hover:text-zinc-300" disabled={balance === null} onClick={() => balance !== null && setAmount(String(balance))}>
              Balance: {balance === null ? "—" : balance.toFixed(2)} USDC (max)
            </button>
          </div>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              reset();
            }}
            placeholder="5.00"
            disabled={busy || secondary}
            className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-violet-500"
          />
          {price !== null && amountNum > 0 && (
            <p className="text-xs text-zinc-500 mt-1.5">≈ {(amountNum / price).toFixed(2)} shares at the current {Math.round(price * 100)}¢ (Panta&apos;s quote is authoritative)</p>
          )}
        </div>

        {quote && h && (
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-sm space-y-1.5">
            <p className="text-zinc-400 text-xs">Panta quote</p>
            {h.shares !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Shares</span>
                <span className="font-medium">{h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
            )}
            {h.price !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Avg price</span>
                <span>{h.price}</span>
              </div>
            )}
            {h.fee !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Fee</span>
                <span>{h.fee}</span>
              </div>
            )}
            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer">Raw quote</summary>
              <pre className="mt-2 overflow-x-auto">{JSON.stringify(quote, null, 2)}</pre>
            </details>
          </div>
        )}

        {verified && <p className="text-xs text-emerald-400">{verified}</p>}
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">{error}</div>}
        {status && <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">{status}</div>}
        {done && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-1">
            <p className="text-emerald-300">Done. {done.attribution}</p>
            <a className="text-zinc-400 underline text-xs" href={txUrl(done.signature)} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          </div>
        )}

        {!quote ? (
          <button
            type="button"
            onClick={getQuote}
            disabled={busy || !publicKey || !ready || !PANTA_WRITES_ENABLED || secondary || !amount}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {busy ? "Working..." : !publicKey ? "Connect Wallet First" : `Get quote to buy ${side.toUpperCase()}`}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={confirmBuy}
              disabled={busy}
              className={`py-3 rounded-lg font-medium transition disabled:opacity-50 ${side === "yes" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}
            >
              {busy ? "Working..." : `Confirm buy ${side.toUpperCase()}`}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-50">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
