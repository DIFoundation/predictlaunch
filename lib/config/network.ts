/**
 * Single switch for the whole app:  NEXT_PUBLIC_SOLANA_NETWORK=mainnet | devnet | testnet
 *
 * Unset / unrecognised => "devnet" on purpose: the safe default never spends real funds.
 * NOTE: Meteora's DBC program is confirmed on mainnet + devnet; whether it exists on Solana
 * "testnet" is checked live on the /status page (it looks up the program account).
 * NOTE: this value is inlined at BUILD time (NEXT_PUBLIC_): on Vercel set it before deploying
 * and redeploy after changing it.
 */
export type Network = "mainnet" | "devnet" | "testnet";

const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "").trim().toLowerCase();

export const NETWORK: Network =
  raw === "mainnet" || raw === "mainnet-beta" ? "mainnet" : raw === "testnet" ? "testnet" : "devnet";
export const NETWORK_WAS_SET = raw !== "";
export const IS_MAINNET = NETWORK === "mainnet";

/** Genesis hashes let us verify the RPC endpoint really is on the configured network. */
export const GENESIS_HASH: Record<Network, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

export function clusterFromGenesis(hash: string): Network | "unknown" {
  for (const n of ["mainnet", "devnet", "testnet"] as const) {
    if (hash === GENESIS_HASH[n]) return n;
  }
  return "unknown";
}

/** Panta's API builds mainnet transactions, so its write actions only work on mainnet. */
export const PANTA_WRITES_ENABLED = IS_MAINNET;

export const SOL_DECIMALS = 9;

/** USDC (mainnet). Panta markets are USDC-collateralised and mainnet-only. */
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

const suffix = IS_MAINNET ? "" : `?cluster=${NETWORK}`;
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
