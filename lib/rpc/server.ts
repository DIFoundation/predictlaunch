import { NETWORK } from "@/lib/config/network";

/**
 * Server-only: resolves the upstream RPC URL for the configured network.
 *   SOLANA_RPC_MAINNET / SOLANA_RPC_DEVNET / SOLANA_RPC_TESTNET (server-only)
 *
 * The active URL is selected ONLY from NEXT_PUBLIC_SOLANA_NETWORK. Changing
 * that single public setting switches the entire app between clusters; no
 * source-code edits are required. Mainnet can use RPC Fast while devnet uses
 * the public Solana Devnet RPC.
 */
const PUBLIC_DEFAULT_HOSTS = new Set(["api.devnet.solana.com", "api.testnet.solana.com", "api.mainnet-beta.solana.com"]);

export interface Upstream {
  url: string | null;
  /** Which env var supplied the URL (for diagnostics). */
  source: string;
  /** Host only -- never log the path/query, it usually contains the API key. */
  host: string | null;
  /** True when this is one of Solana's rate-limited public endpoints, not a real provider. */
  isPublicFallback: boolean;
  /**
   * True when a real endpoint is configured (not the public fallback). We cannot verify from
   * the URL alone that it is literally RPC Fast rather than another provider -- this only
   * distinguishes "you configured something" from "you're on the shared public default".
   */
  isRpcFast: boolean;
}

export function getUpstream(): Upstream {
  let url: string | undefined;
  let source = "none";

  if (NETWORK === "mainnet") {
    if (process.env.SOLANA_RPC_MAINNET?.trim()) {
      url = process.env.SOLANA_RPC_MAINNET.trim();
      source = "SOLANA_RPC_MAINNET";
    }
  } else if (NETWORK === "testnet") {
    if (process.env.SOLANA_RPC_TESTNET?.trim()) {
      url = process.env.SOLANA_RPC_TESTNET.trim();
      source = "SOLANA_RPC_TESTNET";
    } else {
      url = "https://api.testnet.solana.com";
      source = "public testnet default";
    }
  } else if (process.env.SOLANA_RPC_DEVNET?.trim()) {
    url = process.env.SOLANA_RPC_DEVNET.trim();
    source = "SOLANA_RPC_DEVNET";
  } else {
    url = "https://api.devnet.solana.com";
    source = "public devnet default";
  }

  let host: string | null = null;
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") url = undefined;
      else host = u.host;
    } catch {
      url = undefined;
    }
  }
  const isPublicFallback = host !== null && PUBLIC_DEFAULT_HOSTS.has(host);
  return { url: url ?? null, source, host, isPublicFallback, isRpcFast: !!url && !isPublicFallback };
}

export interface RpcCallResult {
  ok: boolean;
  status: number;
  ms: number;
  json?: { result?: unknown; error?: { code: number; message: string } };
  text?: string;
}

/** One JSON-RPC call to the upstream (used by the proxy route and the /status page). */
export async function rpcCall(
  method: string,
  params: unknown[] = [],
  timeoutMs = 15_000
): Promise<RpcCallResult> {
  const { url } = getUpstream();
  if (!url) return { ok: false, status: 0, ms: 0, text: "No RPC URL configured for this network" };

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: RpcCallResult["json"];
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { ok: res.ok && !json?.error, status: res.status, ms: Date.now() - t0, json, text };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      text: e instanceof Error ? e.message : "network error",
    };
  }
}