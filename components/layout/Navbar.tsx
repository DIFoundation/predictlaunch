"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-xl tracking-tight">
            PredictLaunch
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/markets" className="hover:text-white transition">
              Markets
            </Link>
            <Link href="/launches" className="hover:text-white transition">
              Launches
            </Link>
            <Link href="/create" className="hover:text-white transition">
              Create
            </Link>
            <Link href="/launch" className="hover:text-white transition">
              Launch
            </Link>
          </div>
        </div>

        <WalletMultiButton className="bg-violet-600! hover:bg-violet-500! rounded-lg! h-10!" />
      </div>
    </nav>
  );
}