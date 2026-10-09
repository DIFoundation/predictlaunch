import { NextRequest, NextResponse } from "next/server";
import { getUpstream } from "@/lib/rpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-side Solana RPC relay. The browser never sees the RPC URL/key
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
// Vercel (and most serverless platforms) cap a function's own response body size -- an
// unfiltered getProgramAccounts against a shared mainnet program can return many MB and blow
// past that limit, which crashes the function at the PLATFORM level (a bare, non-JSON
// "500 Internal Server Error") regardless of our own try/catch. We check the size ourselves
// and fail with a clear, actionable error before ever attempting to forward a response that big.
const MAX_UPSTREAM_RESPONSE = 4_000_000; // ~4MB, safely under typical serverless response caps
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
  // Top-level safety net: an uncaught exception anywhere below crashes the serverless function
  // itself, which the platform reports as a bare, non-JSON "500 Internal Server Error" -- exactly
  // the symptom that originally made this relay look unreliable for heavy calls. Every return
  // path below is already a clean JSON error; this is only a last resort for anything we didn't
  // anticipate.
  try {
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

    let text: string;
    try {
      text = await req.text();
    } catch (e) {
      return rpcError(400, `Failed to read the request body: ${e instanceof Error ? e.message : "stream error"}`);
    }
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
        "No RPC endpoint configured for the selected network. Check the SOLANA_RPC_<NETWORK> value in .env.local; NEXT_PUBLIC_SOLANA_NETWORK is the only network switch."
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

    let body: string;
    try {
      body = await res.text();
    } catch (e) {
      // A huge, unfiltered getProgramAccounts response (e.g. the Explore feed, or any shared
      // mainnet program) can fail mid-stream rather than just being slow. Report it clearly
      // instead of letting the read throw past us.
      return rpcError(
        502,
        `Failed reading the RPC provider's response: ${e instanceof Error ? e.message : "stream error"}. ` +
          "This can happen when a call (e.g. an unfiltered getProgramAccounts) returns a very large result."
      );
    }

    if (body.length > MAX_UPSTREAM_RESPONSE) {
      return rpcError(
        502,
        `The RPC provider's response was ${(body.length / 1e6).toFixed(1)}MB, too large to relay safely. ` +
          "This usually means an unfiltered getProgramAccounts call matched too many accounts on a shared " +
          "mainnet program (Meteora's DBC program is used by many apps, not just this one). Narrow the " +
          "query with filters, or fetch fewer accounts at a time."
      );
    }

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
  } catch (err) {
    // Genuinely unexpected -- still never let this crash the function into a bare platform 500.
    return rpcError(500, `Unexpected RPC relay error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
