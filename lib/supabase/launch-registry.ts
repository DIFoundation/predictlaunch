import type { LaunchRecord } from "@/types/conviction";
import type { Network } from "@/lib/config/network";

const TABLE = "predictlaunch_launches";

export interface RegistryLaunch extends LaunchRecord {
  network: Network;
  insertedAt?: string;
}

interface DbLaunch {
  network: Network;
  mint: string;
  pool: string;
  config: string;
  signature: string;
  name: string;
  symbol: string;
  description: string | null;
  linked_market_ids: string[];
  conviction_score: number;
  fee_bps: number;
  created_at: string;
  creator: string;
  inserted_at?: string;
}

function config() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }
  return { url, key };
}

function headers(key: string, prefer?: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function fromDb(row: DbLaunch): RegistryLaunch {
  return {
    network: row.network,
    mint: row.mint,
    pool: row.pool,
    config: row.config,
    signature: row.signature,
    name: row.name,
    symbol: row.symbol,
    description: row.description ?? undefined,
    linkedMarketIds: Array.isArray(row.linked_market_ids) ? row.linked_market_ids : [],
    convictionScore: row.conviction_score,
    feeBps: row.fee_bps,
    createdAt: row.created_at,
    creator: row.creator,
    insertedAt: row.inserted_at,
  };
}

function toDb(record: LaunchRecord, network: Network): DbLaunch {
  return {
    network,
    mint: record.mint,
    pool: record.pool,
    config: record.config,
    signature: record.signature,
    name: record.name,
    symbol: record.symbol,
    description: record.description ?? null,
    linked_market_ids: record.linkedMarketIds ?? [],
    conviction_score: record.convictionScore,
    fee_bps: record.feeBps,
    created_at: record.createdAt,
    creator: record.creator,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${TABLE}${path}`, {
    ...init,
    headers: { ...headers(key), ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase launch registry failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return (body ? JSON.parse(body) : null) as T;
}

export async function listRegisteredLaunches(network: Network, limit = 100): Promise<RegistryLaunch[]> {
  const params = new URLSearchParams({
    select: "*",
    network: `eq.${network}`,
    order: "inserted_at.desc",
    limit: String(Math.min(Math.max(limit, 1), 200)),
  });
  const rows = await request<DbLaunch[]>(`?${params.toString()}`);
  return rows.map(fromDb);
}

export async function upsertRegisteredLaunch(record: LaunchRecord, network: Network): Promise<RegistryLaunch> {
  const params = new URLSearchParams({ on_conflict: "network,mint", select: "*" });
  const rows = await request<DbLaunch[]>(`?${params.toString()}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(toDb(record, network)),
  });
  if (!rows?.[0]) throw new Error("Supabase did not return the registered launch.");
  return fromDb(rows[0]);
}
