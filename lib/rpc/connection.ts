import { Connection, clusterApiUrl } from "@solana/web3.js";

let connection: Connection | null = null;

export function getConnection() {
  if (!connection) {
    const envEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    let endpoint: string;

    if (envEndpoint && (envEndpoint.startsWith("http://") || envEndpoint.startsWith("https://"))) {
      endpoint = envEndpoint;
    } else {
      endpoint = clusterApiUrl("mainnet-beta");
    }

    connection = new Connection(endpoint, "confirmed");
  }
  return connection;
}

