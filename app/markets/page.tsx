import Link from "next/link";
import { ArrowUpRight, BarChart3, CircleDollarSign, Sparkles, TrendingUp } from "lucide-react";
import { pantaServer } from "@/lib/panta/server";
import { extractMarketList, isActiveMarket, normalizeMarket } from "@/lib/panta/normalize";
import type { PantaMarket } from "@/types/panta";

export const dynamic = "force-dynamic";

function probability(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export default async function MarketsPage() {
  let markets: PantaMarket[] = [];
  let error: string | null = null;

  try {
    // Ask Panta for active markets upstream, then keep the local lifecycle guard
    // as a defensive check against stale/inconsistent catalog rows.
    const data = await pantaServer.listActiveMarkets({ limit: 50 });
    markets = extractMarketList(data).map(normalizeMarket).filter(isActiveMarket);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load markets";
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-zinc-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.16),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.12),transparent_45%)]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              LIVE PREDICTION MARKETS
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trade the signal.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              Explore live YES/NO odds, discover market conviction, and launch tokens around the strongest signals.
            </p>
          </div>
          <Link href="/create" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300">
            <Sparkles size={16} /> Create market <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500"><BarChart3 size={14} /> Active markets</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{markets.length}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500"><CircleDollarSign size={14} /> Listed volume</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">${markets.reduce((sum, m) => sum + m.volumeUsdc, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="col-span-2 rounded-2xl border border-white/8 bg-black/30 p-4 sm:col-span-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500"><TrendingUp size={14} /> Market source</div>
            <div className="mt-2 text-lg font-semibold">Panta <span className="text-xs font-normal text-zinc-500">· Solana</span></div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-300 whitespace-pre-wrap wrap-break-words">{error}</div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Markets to watch</h2>
            <p className="mt-1 text-sm text-zinc-500">Only active markets are requested from Panta.</p>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">{markets.length} markets</span>
        </div>

        {!error && markets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center">
            <BarChart3 className="mx-auto text-zinc-600" size={28} />
            <p className="mt-4 font-medium text-zinc-300">No active markets found</p>
            <p className="mt-1 text-sm text-zinc-500">Check back soon or create a market to get started.</p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {markets.map((m) => (
            <Link key={m.marketId} href={`/markets/${m.marketId}`} className="group rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-zinc-900/75">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-800">
                  <BarChart3 size={18} className="text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Active</span>
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">{m.category}</span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-medium leading-6 text-zinc-100 transition group-hover:text-emerald-200">{m.title}</h3>
                </div>
                <ArrowUpRight size={17} className="shrink-0 text-zinc-600 transition group-hover:text-emerald-300" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/4.5 p-3">
                  <div className="text-[11px] font-medium tracking-wide text-emerald-300">YES</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{probability(m.yesPrice)}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(m.yesPrice ?? 0) * 100}%` }} /></div>
                </div>
                <div className="rounded-xl border border-rose-400/15 bg-rose-400/4.5 p-3">
                  <div className="text-[11px] font-medium tracking-wide text-rose-300">NO</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{probability(m.noPrice)}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-rose-400" style={{ width: `${(m.noPrice ?? 0) * 100}%` }} /></div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs text-zinc-500">
                <span>Volume <strong className="ml-1 font-medium text-zinc-300">${m.volumeUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
                <span>Closing on <strong className="ml-1 font-medium text-zinc-300">{m.endTime ? new Date(m.endTime * 1000).toLocaleDateString() : 'N/A'}</strong></span>
                <span className="capitalize">{m.phase}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
