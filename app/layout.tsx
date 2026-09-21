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
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 min-h-screen`}>
        <WalletProvider>
          <NetworkProvider>
          <Navbar />
          <NetworkBanner />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
          <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-zinc-600 border-t border-zinc-900">
            Prediction markets <span className="text-zinc-400">Powered by Panta</span> · Launches on
            Meteora Dynamic Bonding Curve · RPC by RPC Fast
          </footer>
          </NetworkProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
