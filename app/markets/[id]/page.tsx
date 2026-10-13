import Link from "next/link";
import { PantaError } from "@/lib/panta/server";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { loadMarket } from "@/lib/panta/load";
import { calculateConviction } from "@/lib/conviction/score";
import { ConvictionPanel } from "@/components/conviction/ConvictionPanel";
import { PantaTradePanel } from "@/components/panta/PantaTradePanel";
import { PriceHistoryChart } from "@/components/charts/PriceHistoryChart";
import { normalizeTrades } from "@/lib/panta/trades";
import { pantaServer } from "@/lib/panta/server";
import type { PantaMarket } from "@/types/panta";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params;

  let market: PantaMarket | undefined;
  let error: string | null = null;
  let notFound = false;
  let trades: ReturnType<typeof normalizeTrades> = [];

  try {
    const m = await loadMarket(id);
    if (m) {
      market = m;
      try {
        trades = normalizeTrades(await pantaServer.getMarketTrades(id));
      } catch {
        trades = []; // history is a nicety, never blocks the page
      }
    } else notFound = true;
  } catch (err) {
    if (err instanceof PantaError && err.status === 404) notFound = true;
    else error = err instanceof Error ? err.message : "Failed to load market";
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* Back to the previous page */}
        <Link
          href={(typeof window !== "undefined" && window.location.href) || ""}
          className="text-sm text-zinc-400 hover:text-white"
          onClick={(e) => {
            e.preventDefault();
            window.history.back();
          }}
        >
          ← Back to Markets
        </Link>
        <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap wrap-break-words">
          {error}
        </div>
      </div>
    );
  }

  if (notFound || !market) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Market not found</p>
        <Link href="/markets" className="text-violet-400 hover:underline mt-4 inline-block">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const conviction = calculateConviction([
    {
      marketId: market.marketId,
      question: market.title,
      volumeUsdc: market.volumeUsdc,
      yesPrice: market.yesPrice,
    },
  ]);

  const stat = "rounded-2xl border border-zinc-800/90 bg-zinc-900/45 p-4";

  return (
    <div className="space-y-7">
      <Link href="/markets" className="text-sm text-zinc-400 hover:text-white">
        ← Back to Markets
      </Link>

      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{market.title}</h1>
        {market.description && market.textQuality === "full" && (
          <p className="text-zinc-400 mt-3">{market.description}</p>
        )}
        <p className="text-xs text-zinc-600 mt-3 break-all">ID: {market.marketId}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <div className={stat}>
          <p className="text-xs text-zinc-500">Category</p>
          <p className="font-medium capitalize mt-1">{market.category}</p>
        </div>
        <div className={stat}>
          <p className="text-xs text-zinc-500">Phase</p>
          <p className="font-medium capitalize mt-1">{market.phase}</p>
        </div>
        <div className={stat}>
          <p className="text-xs text-zinc-500">Volume</p>
          <p className="font-medium mt-1">${market.volumeUsdc.toLocaleString()}</p>
        </div>
        <div className={stat}>
          <p className="text-xs text-zinc-500">YES price</p>
          <p className="font-medium mt-1">
            {market.yesPrice === null ? "No live price" : `${Math.round(market.yesPrice * 100)}%`}
          </p>
        </div>
        <div className={`${stat} md:col-span-2 lg:hidden`}>
          <p className="text-xs text-zinc-500">Resolved</p>
          <p className="font-medium mt-1">
            {market.resolved ? "Yes" : "No"}
          </p>
        </div>
        <div className={`${stat} md:col-span-2 lg:col-span-1`}>
          <p className="text-xs text-zinc-500">Market close</p>
          <p className="font-medium mt-1">
            {market.endTime ? new Date(market.endTime * 1000).toLocaleString() : "N/A"}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Outcome prices</h2><p className="mt-1 text-xs text-zinc-500">Live market probability</p></div>
          <BarChart3 size={17} className="text-zinc-500" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/4.5 p-4">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-emerald-300">YES</span><span className="text-xl font-semibold tabular-nums">{market.yesPrice === null ? "—" : `${(market.yesPrice * 100).toFixed(1)}¢`}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(market.yesPrice ?? 0) * 100}%` }} /></div>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/4.5 p-4">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-rose-300">NO</span><span className="text-xl font-semibold tabular-nums">{market.noPrice === null ? "—" : `${(market.noPrice * 100).toFixed(1)}¢`}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-rose-400" style={{ width: `${(market.noPrice ?? 0) * 100}%` }} /></div>
          </div>
        </div>
      </section>

      <PriceHistoryChart trades={trades} />

      <ConvictionPanel conviction={conviction} />

      <PantaTradePanel
        marketId={market.marketId}
        title={market.title}
        phase={market.phase}
        yesPrice={market.yesPrice}
        noPrice={market.noPrice}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/launch?market=${encodeURIComponent(market.marketId)}`}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-300"
        >
          Launch a token linked to this market <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}
