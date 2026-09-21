"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/components/network/NetworkProvider";
import { IS_MAINNET, txUrl } from "@/lib/config/network";
import { prepareSwap, tokenBalance, type PoolView, type Side, type SwapPreview } from "@/lib/meteora/pools";
import { simulateLaunch as simulate } from "@/lib/meteora/client";
import { sendAndConfirm } from "@/lib/rpc/connection";
import { launchStore } from "@/lib/conviction/store";

const SLIPPAGE_OPTIONS = [50, 100, 300, 500]; // bps

function fmt(n: number, max = 6) {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.000001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/** Buy / sell a launched token on its Meteora bonding curve without leaving the app. */
export function TokenTradePanel({
  pool,
  poolAddress,
  onTraded,
}: {
  pool: PoolView;
  poolAddress?: string;
  onTraded: () => void;
}) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { ready, blockReason } = useNetwork();

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(100);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokBalance, setTokBalance] = useState<number | null>(null);

  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [lamports, tokens] = await Promise.all([
        connection.getBalance(publicKey),
        tokenBalance(connection, publicKey, pool.mint),
      ]);
      setSolBalance(lamports / 1e9);
      setTokBalance(tokens / 10 ** pool.decimals);
    } catch {
      /* balances are informational */
    }
  }, [connection, publicKey, pool.mint, pool.decimals]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await refreshBalances();
    })();
    return () => {
      alive = false;
    };
  }, [refreshBalances]);

  if (pool.isMigrated) {
    return (
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
        This token has graduated from its bonding curve and now trades on Meteora DAMM v2. In-app curve
        trading is closed for it.
      </div>
    );
  }

  const inSymbol = side === "buy" ? "SOL" : pool.symbol || "tokens";
  const outSymbol = side === "buy" ? pool.symbol || "tokens" : "SOL";
  const balance = side === "buy" ? solBalance : tokBalance;

  async function getQuote() {
    setError(null);
    setPreview(null);
    setLastSig(null);
    if (!publicKey) return setError("Connect your wallet first");
    if (!ready) return setError(blockReason);
    setBusy(true);
    setStatus("Getting a live quote from the curve...");
    try {
      const p = await prepareSwap(connection, {
        mint: pool.mint,
        owner: publicKey,
        side,
        amount,
        slippageBps: slippage,
        poolAddress,
      });
      setPreview(p);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTrade() {
    if (!preview || !publicKey || !signTransaction) return;
    if (
      IS_MAINNET &&
      !window.confirm(
        `MAINNET trade: ${side === "buy" ? "spend" : "sell"} ${amount} ${inSymbol} for at least ${fmt(preview.minOut)} ${outSymbol}. Continue?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The quote may be stale by now: rebuild against the current curve state and make sure it
      // still honours the minimum the user accepted.
      setStatus("Refreshing quote...");
      const fresh = await prepareSwap(connection, {
        mint: pool.mint,
        owner: publicKey,
        side,
        amount,
        slippageBps: slippage,
        poolAddress,
      });
      if (fresh.expectedOut < preview.minOut) {
        throw new Error("The price moved beyond your slippage since the quote. Get a new quote.");
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = fresh.tx;
      tx.feePayer = publicKey;
      tx.recentBlockhash = blockhash;

      setStatus("Simulating...");
      await simulate(connection, tx);

      setStatus("Approve the trade in your wallet...");
      const signed = await signTransaction(tx);
      setStatus("Confirming on-chain...");
      const sig = await sendAndConfirm(connection, signed, lastValidBlockHeight);

      launchStore.rememberMint(pool.mint);
      setLastSig(sig);
      setStatus("Trade confirmed!");
      setPreview(null);
      setAmount("");
      await refreshBalances();
      onTraded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trade failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="grid grid-cols-2 border-b border-zinc-800">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setPreview(null);
              setAmount("");
              setError(null);
            }}
            disabled={busy}
            className={`py-3 text-sm font-medium transition ${
              side === s
                ? s === "buy"
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "bg-rose-600/20 text-rose-300"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <span>You pay ({inSymbol})</span>
            <button
              type="button"
              className="hover:text-zinc-300"
              onClick={() => balance !== null && setAmount(String(side === "buy" ? Math.max(0, balance - 0.02) : balance))}
              disabled={balance === null}
            >
              Balance: {balance === null ? "—" : fmt(balance)} (max)
            </button>
          </div>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setPreview(null);
            }}
            placeholder="0.0"
            disabled={busy}
            className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          Slippage
          {SLIPPAGE_OPTIONS.map((bps) => (
            <button
              key={bps}
              onClick={() => {
                setSlippage(bps);
                setPreview(null);
              }}
              disabled={busy}
              className={`px-2 py-1 rounded ${slippage === bps ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              {bps / 100}%
            </button>
          ))}
        </div>

        {preview && (
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-400">You receive (est.)</span>
              <span className="font-medium">
                {fmt(preview.expectedOut)} {outSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Minimum after slippage</span>
              <span>
                {fmt(preview.minOut)} {outSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Trading fee</span>
              <span>
                {fmt(preview.fee)} {inSymbol} ({(pool.feeBps / 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">{error}</div>}
        {status && <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">{status}</div>}
        {lastSig && (
          <p className="text-xs text-emerald-400">
            Done.{" "}
            <a className="underline" href={txUrl(lastSig)} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          </p>
        )}

        {!preview ? (
          <button
            onClick={getQuote}
            disabled={busy || !publicKey || !ready || !amount}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {busy ? "Working..." : !publicKey ? "Connect Wallet First" : "Get quote"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={confirmTrade}
              disabled={busy}
              className={`py-3 rounded-lg font-medium transition disabled:opacity-50 ${side === "buy" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}
            >
              {busy ? "Working..." : `Confirm ${side}`}
            </button>
            <button onClick={() => setPreview(null)} disabled={busy} className="py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-50">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
