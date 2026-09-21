/**
 * Single switch for the whole app:  NEXT_PUBLIC_SOLANA_NETWORK=mainnet | devnet
 *
 * Unset / unrecognised => "devnet" on purpose: the safe default never spends
 * real funds. (Meteora's DBC test environment is devnet; Solana's "testnet"
 * cluster is not used, so "testnet" is treated as devnet.)
 */
export type Network = "mainnet" | "devnet";

const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "").trim().toLowerCase();

export const NETWORK: Network =
  raw === "mainnet" || raw === "mainnet-beta" ? "mainnet" : "devnet";
export const NETWORK_WAS_SET = raw !== "";
export const IS_MAINNET = NETWORK === "mainnet";

/** Genesis hashes let us verify the RPC endpoint really is on the configured network. */
export const GENESIS_HASH: Record<Network, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

export function clusterFromGenesis(hash: string): Network | "testnet" | "unknown" {
  if (hash === GENESIS_HASH.mainnet) return "mainnet";
  if (hash === GENESIS_HASH.devnet) return "devnet";
  if (hash === "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY") return "testnet";
  return "unknown";
}

/** Panta's API builds mainnet transactions, so its write actions only work on mainnet. */
export const PANTA_WRITES_ENABLED = IS_MAINNET;

export const SOL_DECIMALS = 9;

const suffix = IS_MAINNET ? "" : "?cluster=devnet";
export const txUrl = (sig: string) => `https://solscan.io/tx/${sig}${suffix}`;
export const addressUrl = (addr: string) => `https://solscan.io/account/${addr}${suffix}`;

export function isPublicHttpsUrl(u: string | undefined): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
