"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { detectCluster } from "@/lib/rpc/connection";
import { NETWORK, IS_MAINNET, type Network } from "@/lib/config/network";

type State =
  | { status: "checking" }
  | { status: "ok"; cluster: Network }
  | { status: "mismatch"; cluster: string }
  | { status: "error"; message: string };

interface Ctx {
  network: Network;
  state: State;
  /** True only when the RPC is reachable AND on the configured network. Gate every transaction on this. */
  ready: boolean;
  /** Human-readable reason transactions are blocked, or null. */
  blockReason: string | null;
}

const NetworkContext = createContext<Ctx>({
  network: NETWORK,
  state: { status: "checking" },
  ready: false,
  blockReason: "Checking network...",
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    detectCluster(connection)
      .then((cluster) => {
        if (!alive) return;
        setState(cluster === NETWORK ? { status: "ok", cluster: NETWORK } : { status: "mismatch", cluster });
      })
      .catch((e: unknown) => {
        if (alive) setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, [connection]);

  const ready = state.status === "ok";
  const blockReason =
    state.status === "ok"
      ? null
      : state.status === "checking"
        ? "Checking the RPC connection..."
        : state.status === "mismatch"
          ? `The RPC endpoint is on ${state.cluster}, but the app is set to ${NETWORK}.`
          : `RPC unreachable: ${state.message}`;

  return (
    <NetworkContext.Provider value={{ network: NETWORK, state, ready, blockReason }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function NetworkBanner() {
  const { network, state } = useNetwork();

  return (
    <div className="border-b border-zinc-900 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`px-2 py-0.5 rounded-full border ${
            IS_MAINNET
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300"
          }`}
        >
          {network === "mainnet" ? "Mainnet — real funds" : network === "testnet" ? "Testnet — test funds" : "Devnet — test funds"}
        </span>
        {state.status === "checking" && <span className="text-zinc-500">Connecting to RPC...</span>}
        {state.status === "ok" && <span className="text-zinc-500">RPC connected</span>}
        {state.status === "mismatch" && (
          <span className="text-red-400">
            RPC is on <b>{state.cluster}</b> but the app is set to <b>{network}</b>. Transactions are
            disabled. Fix SOLANA_RPC_{network.toUpperCase()} — see{" "}
            <a href="/status" className="underline">
              /status
            </a>
            .
          </span>
        )}
        {state.status === "error" && (
          <span className="text-red-400 break-all">
            RPC error: {state.message.slice(0, 220)}{" "}
            <a href="/status" className="underline">
              Diagnose →
            </a>
          </span>
        )}
      </div>
    </div>
  );
}
