"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Activity, ArrowLeftRight, Compass, FlaskConical, Layers3, Rocket, Sparkles, Wallet } from "lucide-react";

const GROUPS = [
  {
    label: "Trade",
    links: [
      { href: "/markets", label: "Markets", icon: Layers3 },
      { href: "/explore", label: "Explore", icon: Compass },
    ],
  },
  {
    label: "Your assets",
    links: [
      { href: "/portfolio", label: "Portfolio", icon: Wallet },
      { href: "/launches", label: "My launches", icon: Rocket },
    ],
  },
  {
    label: "Build",
    links: [
      { href: "/launch", label: "Launch token", icon: Sparkles },
      { href: "/create", label: "Create market", icon: FlaskConical },
    ],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-zinc-950/90 backdrop-blur-xl">
      <nav aria-label="Main navigation" className="mx-auto max-w-7xl px-3 sm:px-5">
        <div className="flex h-[68px] items-center justify-between gap-3">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-300 transition group-hover:bg-emerald-300/[0.14]">
              <ArrowLeftRight size={18} strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-white">Predict<span className="text-emerald-300">Launch</span></span>
              <span className="hidden text-[10px] tracking-[0.16em] text-zinc-500 sm:block">SIGNAL → ON-CHAIN</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-1">
                <span className="mx-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{group.label}</span>
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition ${active ? "bg-emerald-300/[0.1] text-emerald-200" : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"}`}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  );
                })}
                {group.label !== "Build" && <span className="mx-2 h-5 w-px bg-white/[0.07]" />}
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/status" aria-label="System status" title="System status" className={`hidden h-9 w-9 items-center justify-center rounded-xl border transition sm:inline-flex ${isActive("/status") ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white"}`}>
              <Activity size={16} />
            </Link>
            <WalletMultiButton className="!h-10 !rounded-xl !border !border-emerald-300/20 !bg-emerald-300/[0.09] !px-3 !text-xs !font-semibold !text-emerald-100 hover:!bg-emerald-300/[0.16]" />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-white/[0.055] py-2 lg:hidden">
          {GROUPS.flatMap((group) => group.links).map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${active ? "bg-emerald-300/[0.1] text-emerald-200" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}
              >
                <Icon size={13} />{label}
              </Link>
            );
          })}
          <Link href="/status" className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${isActive("/status") ? "bg-emerald-300/[0.1] text-emerald-200" : "text-zinc-500 hover:text-white"}`}>
            <Activity size={13} /> Status
          </Link>
        </div>
      </nav>
    </header>
  );
}
