"use client";

import { useMemo, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { getRpcEndpoint } from "@/lib/rpc/connection";

// Default styles for the wallet modal
import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletProvider({ children }: { children: ReactNode }) {
  // IMPORTANT: this must stay pointed at OUR /api/rpc relay, not a direct provider URL.
  // Every useConnection() call in the app (buying, portfolio, explore, status) goes through
  // this one endpoint. A direct URL here was tried once while debugging a Phantom-specific
  // signing bug (unrelated -- see lib/meteora/client.ts's note on stale extension ports) and
  // it quietly bypassed every protection the relay provides: it put the RPC URL (and any
  // embedded API key) into a NEXT_PUBLIC_ variable shipped to every browser, skipped our
  // origin/method-allowlist/rate-limit checks, and broke the "every read and write goes
  // through our own RPC" property the RPC Fast track submission relies on. If a heavy call
  // (e.g. Explore's getProgramAccounts) seems to fail through the relay, fix the relay
  // (see app/api/rpc/route.ts's size guard and lib/meteora/pools.ts's early-slice) rather
  // than routing around it.
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}