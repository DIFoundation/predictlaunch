import { NETWORK, NETWORK_WAS_SET, clusterFromGenesis } from "@/lib/config/network";
import { getUpstream, rpcCall } from "@/lib/rpc/server";
import { pantaServer } from "@/lib/panta/server";
import { extractCategories, extractMarketList } from "@/lib/panta/normalize";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

// A memcmp that can never match => gPA returns [] instantly, but many free RPC plans reject the method outright (403).
const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

/** Server-side diagnostics for the /status page. Never returns secrets (only hosts / booleans). */
export async function runDiagnostics(): Promise<{ network: string; checks: Check[] }> {
  const checks: Check[] = [];
  const up = getUpstream();

  checks.push({
    name: "Network setting",
    ok: NETWORK_WAS_SET,
    detail: `NEXT_PUBLIC_SOLANA_NETWORK = ${NETWORK}${NETWORK_WAS_SET ? "" : " (unset, defaulting to devnet)"}`,
    hint: NETWORK_WAS_SET ? undefined : "Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet or devnet in .env.local",
  });

  checks.push({
    name: "RPC endpoint configured",
    ok: !!up.url,
    detail: up.url ? `${up.host} (from ${up.source})` : "none",
    hint: up.url ? undefined : `Set SOLANA_RPC_${NETWORK.toUpperCase()} in .env.local`,
  });

  if (up.url) {
    const genesis = await rpcCall("getGenesisHash");
    const hash = typeof genesis.json?.result === "string" ? genesis.json.result : "";
    const cluster = hash ? clusterFromGenesis(hash) : null;
    checks.push({
      name: "RPC reachable (getGenesisHash)",
      ok: genesis.ok && cluster === NETWORK,
      detail: genesis.ok
        ? `${genesis.ms}ms, cluster = ${cluster}`
        : `HTTP ${genesis.status || "network error"}: ${(genesis.json?.error?.message || genesis.text || "").slice(0, 160)}`,
      hint: !genesis.ok
        ? genesis.status === 401 || genesis.status === 403
          ? "The provider rejected the request. Check the API key in the URL, the key's allowed origins / IP allowlist (a server-side call has no browser origin, but may come from an unlisted IP), and that the key is active."
          : "Check the URL is correct and reachable."
        : cluster !== NETWORK
          ? `This RPC is on ${cluster} but the app is set to ${NETWORK}.`
          : undefined,
    });

    const bh = await rpcCall("getLatestBlockhash");
    checks.push({
      name: "Latest blockhash (needed to send txs)",
      ok: bh.ok,
      detail: bh.ok ? `${bh.ms}ms` : `HTTP ${bh.status}: ${(bh.json?.error?.message || bh.text || "").slice(0, 160)}`,
    });

    const prog = await rpcCall("getAccountInfo", [DBC_PROGRAM, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
    const progVal = (prog.json?.result as { value?: { executable?: boolean } | null } | undefined)?.value;
    checks.push({
      name: "Meteora DBC program deployed on this network",
      ok: prog.ok && !!progVal?.executable,
      detail: !prog.ok
        ? `lookup failed: HTTP ${prog.status}`
        : progVal?.executable
          ? "found (executable)"
          : `NOT found on ${NETWORK}`,
      hint:
        prog.ok && !progVal?.executable
          ? `Meteora DBC is not deployed on ${NETWORK}, so token launches and curve trading cannot work here. Use devnet or mainnet.`
          : undefined,
    });

    const gpa = await rpcCall("getProgramAccounts", [
      DBC_PROGRAM,
      {
        encoding: "base64",
        dataSlice: { offset: 0, length: 0 },
        filters: [{ memcmp: { offset: 0, bytes: "1111111111" } }],
      },
    ]);
    checks.push({
      name: "getProgramAccounts (needed to list launches)",
      ok: gpa.ok,
      detail: gpa.ok ? `${gpa.ms}ms` : `HTTP ${gpa.status}: ${(gpa.json?.error?.message || gpa.text || "").slice(0, 160)}`,
      hint: gpa.ok
        ? undefined
        : "Many RPC plans block getProgramAccounts (returns 403/-32010). Ask RPC Fast to enable it or upgrade the plan; until then 'My launches' will not load.",
    });
  }

  checks.push({
    name: "Panta API key set",
    ok: !!process.env.PANTA_API_KEY,
    detail: process.env.PANTA_API_KEY
      ? process.env.PANTA_API_KEY.startsWith("pk_live_")
        ? "pk_live_… (live)"
        : "set, but NOT a pk_live_ key (sandbox fixtures only)"
      : "missing",
    hint: process.env.PANTA_API_KEY?.startsWith("pk_live_") ? undefined : "Use a pk_live_ key for real data.",
  });

  try {
    const t0 = Date.now();
    const data = await pantaServer.listMarkets({ limit: 3 });
    checks.push({
      name: "Panta markets API",
      ok: true,
      detail: `${Date.now() - t0}ms, ${extractMarketList(data).length} markets returned`,
    });
  } catch (e) {
    checks.push({
      name: "Panta markets API",
      ok: false,
      detail: (e instanceof Error ? e.message : String(e)).slice(0, 220),
    });
  }

  // Attribution = trades routed through THIS API key (what Panta's builder track can measure).
  try {
    const m = await pantaServer.getAccountMetrics();
    checks.push({
      name: "Panta attribution metrics (/account/metrics/)",
      ok: true,
      detail: JSON.stringify(m).slice(0, 220),
    });
  } catch (e) {
    checks.push({
      name: "Panta attribution metrics (/account/metrics/)",
      ok: false,
      detail: (e instanceof Error ? e.message : String(e)).slice(0, 220),
      hint: "This endpoint reports volume attributed to your API key. It may need a key created via /account/keys/.",
    });
  }

  try {
    const cats = extractCategories(await pantaServer.getCategories());
    checks.push({
      name: "Panta categories allowlist",
      ok: cats.length > 0,
      detail: cats.length ? cats.map((c) => c.value).join(", ").slice(0, 200) : "endpoint answered but no categories parsed",
    });
  } catch (e) {
    checks.push({ name: "Panta categories allowlist", ok: false, detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }

  try {
    await pantaServer.getMarketTrades("__status_probe__");
    checks.push({ name: "Panta trade history (/markets/{id}/trades/)", ok: true, detail: "endpoint reachable" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A 404 for a fake market id still proves the ROUTE exists and is reachable.
    const reachable = /404/.test(msg);
    checks.push({
      name: "Panta trade history (/markets/{id}/trades/)",
      ok: reachable,
      detail: reachable ? "endpoint reachable (404 for a fake market id, as expected)" : msg.slice(0, 220),
    });
  }

  return { network: NETWORK, checks };
}
