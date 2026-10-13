import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Navbar } from "@/components/layout/Navbar";
import { NetworkProvider, NetworkBanner } from "@/components/network/NetworkProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PredictLaunch",
  description: "The launchpad where conviction is measurable.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#09090b] text-zinc-50 antialiased selection:bg-emerald-300/25 selection:text-emerald-50`}>
        <WalletProvider>
          <NetworkProvider>
          <Navbar />
          <NetworkBanner />
          <main className="mx-auto max-w-7xl px-4 py-7 sm:px-5 sm:py-9">{children}</main>
          <footer className="mx-auto mt-8 max-w-7xl border-t border-white/6 px-4 py-8 text-xs text-zinc-600 sm:px-5">
            Prediction markets <span className="text-zinc-400">Powered by Panta</span> · Launches on
            Meteora Dynamic Bonding Curve · RPC by RPC Fast
          </footer>
          </NetworkProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
