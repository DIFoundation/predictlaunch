import { Connection, clusterApiUrl } from "@solana/web3.js";

/** Single source of truth for the RPC endpoint (RPC Fast). Used by WalletProvider and helpers. */
export function getRpcEndpoint(): string {
  const env = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (env && (env.startsWith("http://") || env.startsWith("https://"))) return env;

  if (typeof window !== "undefined") {
    console.warn(
      "[PredictLaunch] NEXT_PUBLIC_RPC_ENDPOINT is not set -- falling back to the public " +
        "mainnet RPC. Set your RPC Fast endpoint to satisfy the RPC Fast track."
    );
  }
  return clusterApiUrl("mainnet-beta");
}

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(getRpcEndpoint(), "confirmed");
  return connection;
}

const GENESIS: Record<string, string> = {
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: "devnet",
  "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY": "testnet",
};

/** Detects which cluster the RPC endpoint actually points at (via genesis hash). */
export async function detectCluster(conn: Connection): Promise<string> {
  try {
    const hash = await conn.getGenesisHash();
    return GENESIS[hash] ?? "unknown";
  } catch {
    return "unknown";
  }
}
