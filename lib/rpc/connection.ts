import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { clusterFromGenesis } from "@/lib/config/network";

/**
 * The browser talks to OUR /api/rpc relay, never to the RPC provider directly
 * (the relay forwards to RPC Fast using a server-side URL/key).
 */
export function getRpcEndpoint(): string {
  if (typeof window !== "undefined") return `${window.location.origin}/api/rpc`;
  return "http://localhost:3000/api/rpc"; // SSR placeholder; never actually called
}

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(getRpcEndpoint(), "confirmed");
  return connection;
}

export type SignTx = <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;

/** Which cluster is the RPC really on? Reads the genesis hash. Throws with the relay's message on failure. */
export async function detectCluster(conn: Connection) {
  const hash = await conn.getGenesisHash();
  return clusterFromGenesis(hash);
}

/**
 * Confirm by polling getSignatureStatuses. (web3.js's default confirmTransaction
 * opens a WebSocket to the RPC URL, which our HTTP relay cannot serve.)
 */
export async function confirmSignature(
  conn: Connection,
  signature: string,
  lastValidBlockHeight?: number,
  timeoutMs = 90_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await conn.getSignatureStatuses([signature]);
    const st = value[0];
    if (st) {
      if (st.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(st.err)}`);
      if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return;
    }
    if (lastValidBlockHeight !== undefined) {
      const h = await conn.getBlockHeight("confirmed");
      if (h > lastValidBlockHeight) {
        // One last look before declaring it dead.
        const again = await conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
        if (again.value[0] && !again.value[0].err) return;
        throw new Error("Transaction expired before confirmation. It was not executed; try again.");
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for confirmation of ${signature}. Check its status before retrying.`);
}

/** Send an already-signed tx and wait for confirmation. */
export async function sendAndConfirm(
  conn: Connection,
  signed: Transaction | VersionedTransaction,
  lastValidBlockHeight?: number
): Promise<string> {
  const lv =
    lastValidBlockHeight ?? (await conn.getLatestBlockhash("confirmed")).lastValidBlockHeight;
  const signature = await conn.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  await confirmSignature(conn, signature, lv);
  return signature;
}
