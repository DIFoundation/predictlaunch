"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/launches", label: "My Launches" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/create", label: "Create Market" },
  { href: "/launch", label: "Launch Token" },
];

export function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-xl tracking-tight">
            PredictLaunch
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white transition">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <WalletMultiButton className="bg-violet-600! hover:bg-violet-500! rounded-lg! h-10!" />
      </div>

      {/* The desktop links are hidden below md -- without this row there was NO navigation on phones. */}
      <div className="md:hidden border-t border-zinc-800/60 overflow-x-auto">
        <div className="flex gap-5 px-4 py-2.5 text-sm text-zinc-400 whitespace-nowrap">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
