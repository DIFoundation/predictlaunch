import { NETWORK } from "@/lib/config/network";

/**
 * Server-only: resolves the upstream RPC URL for the configured network.
 *   SOLANA_RPC_MAINNET / SOLANA_RPC_DEVNET   (preferred; NOT exposed to the browser)
 *   NEXT_PUBLIC_RPC_ENDPOINT                 (legacy fallback, mainnet only)
 */
export interface Upstream {
  url: string | null;
  /** Which env var supplied the URL (for diagnostics). */
  source: string;
  /** Host only -- never log the path/query, it usually contains the API key. */
  host: string | null;
}

export function getUpstream(): Upstream {
  let url: string | undefined;
  let source = "none";

  if (NETWORK === "mainnet") {
    if (process.env.SOLANA_RPC_MAINNET?.trim()) {
      url = process.env.SOLANA_RPC_MAINNET.trim();
      source = "SOLANA_RPC_MAINNET";
    } else if (process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim()) {
      url = process.env.NEXT_PUBLIC_RPC_ENDPOINT.trim();
      source = "NEXT_PUBLIC_RPC_ENDPOINT (legacy)";
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
  return { url: url ?? null, source, host };
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
