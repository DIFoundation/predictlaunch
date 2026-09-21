import { NextRequest, NextResponse } from "next/server";
import { getUpstream } from "@/lib/rpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-side Solana RPC relay (RPC Fast). The browser never sees the RPC URL/key
 * and never talks to the provider directly, which removes origin/CORS/domain-
 * allowlist 403s and stops the key leaking through a NEXT_PUBLIC_ variable.
 *
 * Guardrails (this is an open door to a paid RPC quota otherwise):
 *   - same-origin browsers only
 *   - method allowlist
 *   - small body cap, small batch cap
 *   - best-effort per-IP rate limit
 */
const ALLOWED = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getLatestBlockhash",
  "isBlockhashValid",
  "getBlockHeight",
  "getSlot",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getTransaction",
  "sendTransaction",
  "simulateTransaction",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getTokenSupply",
  "getProgramAccounts",
  "getGenesisHash",
  "getVersion",
  "getHealth",
  "getMinimumBalanceForRentExemption",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getEpochInfo",
  "getBlockTime",
]);

const MAX_BODY = 100_000;
const MAX_BATCH = 20;
const RATE_PER_MIN = 240;
const hits = new Map<string, { n: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n += 1;
  return h.n > RATE_PER_MIN;
}

function rpcError(status: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32000, message } },
    { status }
  );
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return rpcError(403, "Cross-origin RPC access is not allowed");
    } catch {
      return rpcError(403, "Bad origin");
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return rpcError(429, "Too many RPC requests, slow down");

  const text = await req.text();
  if (text.length > MAX_BODY) return rpcError(413, "RPC request too large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return rpcError(400, "Invalid JSON");
  }
  const calls = Array.isArray(parsed) ? parsed : [parsed];
  if (calls.length === 0 || calls.length > MAX_BATCH) return rpcError(400, "Bad batch size");
  for (const c of calls) {
    const method = (c as { method?: unknown })?.method;
    if (typeof method !== "string" || !ALLOWED.has(method)) {
      return rpcError(403, `RPC method not allowed: ${String(method)}`);
    }
  }

  const upstream = getUpstream();
  if (!upstream.url) {
    return rpcError(
      500,
      "No RPC endpoint configured. Set SOLANA_RPC_MAINNET / SOLANA_RPC_DEVNET (see .env.example)."
    );
  }

  let res: Response;
  try {
    res = await fetch(upstream.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return rpcError(502, `Could not reach RPC provider (${upstream.host}): ${e instanceof Error ? e.message : "error"}`);
  }

  const body = await res.text();
  if (!res.ok) {
    // Turn the provider's bare status into something actionable for the developer.
    const hint =
      res.status === 401 || res.status === 403
        ? " -- check the API key in the RPC URL, the key's allowed origins/IPs, and that your plan allows this method. See /status."
        : res.status === 429
          ? " -- provider rate limit hit."
          : "";
    return rpcError(
      res.status,
      `RPC provider ${upstream.host} returned ${res.status}${hint} ${body.slice(0, 200)}`
    );
  }

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
