import { NextRequest, NextResponse } from "next/server";
import { NETWORK } from "@/lib/config/network";
import { rpcCall } from "@/lib/rpc/server";
import { listRegisteredLaunches, upsertRegisteredLaunch } from "@/lib/supabase/launch-registry";
import type { LaunchRecord } from "@/types/conviction";

export const dynamic = "force-dynamic";

const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  try {
    const networkParam = req.nextUrl.searchParams.get("network");
    const network = networkParam === "mainnet" || networkParam === "devnet" || networkParam === "testnet"
      ? networkParam
      : NETWORK;
    const items = await listRegisteredLaunches(network, Number(req.nextUrl.searchParams.get("limit") || 100));
    return NextResponse.json({ items, network });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the launch directory" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<LaunchRecord>;
    const { mint, pool, config, signature, name, symbol, linkedMarketIds, convictionScore, feeBps, createdAt, creator } = body;

    if (
      typeof mint !== "string" || !BASE58.test(mint) ||
      typeof pool !== "string" || !BASE58.test(pool) ||
      typeof config !== "string" || !BASE58.test(config) ||
      typeof signature !== "string" || signature.length < 80 || signature.length > 100 ||
      typeof name !== "string" || !name.trim() || name.length > 32 ||
      typeof symbol !== "string" || !symbol.trim() || symbol.length > 10 ||
      typeof creator !== "string" || !BASE58.test(creator) ||
      !Array.isArray(linkedMarketIds) || linkedMarketIds.some((id) => typeof id !== "string") ||
      typeof convictionScore !== "number" || convictionScore < 0 || convictionScore > 100 ||
      typeof feeBps !== "number" || feeBps < 0 || feeBps > 10_000 ||
      typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt))
    ) {
      return NextResponse.json({ error: "Invalid launch record." }, { status: 400 });
    }

    // Do not accept arbitrary client-submitted tokens: verify that the submitted
    // confirmed transaction actually contains the DBC program and the launch addresses.
    const tx = await rpcCall("getTransaction", [
      signature,
      { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    ]);
    const txData = tx.json?.result as {
      meta?: { err?: unknown } | null;
      transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } };
    } | null | undefined;
    if (!tx.ok || !txData || txData.meta?.err) {
      return NextResponse.json({ error: "Could not verify a successful confirmed launch transaction on the configured network." }, { status: 422 });
    }
    const keys = (txData.transaction?.message?.accountKeys ?? []).map((entry) =>
      typeof entry === "string" ? entry : entry.pubkey ?? ""
    );
    if (![mint, pool, config, DBC_PROGRAM].every((key) => keys.includes(key))) {
      return NextResponse.json({ error: "The transaction does not contain the submitted mint, pool, config and Meteora DBC program." }, { status: 422 });
    }

    const record: LaunchRecord = {
      mint, pool, config, signature, name: name.trim(), symbol: symbol.trim().toUpperCase(),
      description: typeof body.description === "string" ? body.description.slice(0, 500) : undefined,
      linkedMarketIds: linkedMarketIds.slice(0, 20),
      convictionScore: Math.round(convictionScore),
      feeBps: Math.round(feeBps),
      createdAt,
      creator,
    };
    const saved = await upsertRegisteredLaunch(record, NETWORK);
    return NextResponse.json({ item: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not register launch" },
      { status: 503 }
    );
  }
}
