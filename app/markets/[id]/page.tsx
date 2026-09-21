import Link from "next/link";
import { pantaServer, PantaError } from "@/lib/panta/server";
import { normalizeMarket } from "@/lib/panta/normalize";
import { calculateConviction } from "@/lib/conviction/score";
import { ConvictionPanel } from "@/components/conviction/ConvictionPanel";
import type { PantaMarket, PantaMarketRaw } from "@/types/panta";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params;

  let market: PantaMarket | undefined;
  let error: string | null = null;
  let notFound = false;

  try {
    const raw = (await pantaServer.getMarket(id)) as PantaMarketRaw;
    if (raw && raw.marketId) market = normalizeMarket(raw);
    else notFound = true;
  } catch (err) {
    if (err instanceof PantaError && err.status === 404) notFound = true;
    else error = err instanceof Error ? err.message : "Failed to load market";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/markets" className="text-sm text-zinc-400 hover:text-white">
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

  const stat = "p-4 rounded-lg bg-zinc-900 border border-zinc-800";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Link href="/markets" className="text-sm text-zinc-400 hover:text-white">
        ← Back to Markets
      </Link>

      <div>
        <h1 className="text-3xl font-bold leading-tight">{market.title}</h1>
        {market.description && market.textQuality === "full" && (
          <p className="text-zinc-400 mt-3">{market.description}</p>
        )}
        <p className="text-xs text-zinc-600 mt-3 break-all">ID: {market.marketId}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      <ConvictionPanel conviction={conviction} />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Trade</h2>
          <span className="text-xs text-zinc-500">Powered by Panta</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-600/20">
            <p className="text-xs text-emerald-300">YES</p>
            <p className="text-xl font-bold mt-1">{market.yesPrice === null ? "—" : `${Math.round(market.yesPrice * 100)}¢`}</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-600/10 border border-rose-600/20">
            <p className="text-xs text-rose-300">NO</p>
            <p className="text-xl font-bold mt-1">{market.noPrice === null ? "—" : `${Math.round(market.noPrice * 100)}¢`}</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          In-app buying of YES/NO shares needs Panta&apos;s order endpoints, which are not wired yet
          (see docs/PANTA_TRADING.md). Your existing positions are shown on the Portfolio page.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/launch?market=${encodeURIComponent(market.marketId)}`}
          className="px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition"
        >
          Launch a token linked to this market →
        </Link>
      </div>
    </div>
  );
}
