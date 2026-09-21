import Link from "next/link";
import { pantaServer } from "@/lib/panta/server";
import { PantaMarket } from "@/types/panta";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: Props) {
    const { id } = await params;

    let market: PantaMarket | undefined;
    let error: string | null = null;

    try {
        // For now we try to get from list (later we can add a proper getMarket)
        const data = await pantaServer.listMarkets({ limit: 50 });
        const markets = data.items;
        market = markets.find((m: PantaMarket) => m.marketId === id);
    } catch (err: any) {
        error = err.message;
    }

    if (error) {
        return (
            <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                {error}
            </div>
        );
    }

    if (!market) {
        return (
            <div className="text-center py-20">
                <p className="text-zinc-400">Market not found</p>
                <Link href="/markets" className="text-violet-400 hover:underline mt-4 inline-block">
                    ← Back to Markets
                </Link>
            </div>
        );
    }

    if (!id) {
        return (
            <div className="text-center py-20">
                <p className="text-zinc-400">Market not found</p>
                <Link href="/markets" className="text-violet-400 hover:underline mt-4 inline-block">
                    ← Back to Markets
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <Link href="/markets" className="text-sm text-zinc-400 hover:text-white">
                ← Back to Markets
            </Link>

            <div>
                <h1 className="text-3xl font-bold leading-tight">
                    {id}
                </h1>
                {market.description && (
                    <p className="text-zinc-400 mt-3">{market.description}</p>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-xs text-zinc-500">Category</p>
                    <p className="font-medium capitalize mt-1">{market.category || "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-medium mt-1">{market.phase || market.status || "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-xs text-zinc-500">Volume</p>
                    <p className="font-medium mt-1">
                        {market.volumeUsdc ? `$${Number(market.volumeUsdc).toLocaleString()}` : "—"}
                    </p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-xs text-zinc-500">Type</p>
                    <p className="font-medium mt-1 capitalize">{market.marketType || "standard"}</p>
                </div>
            </div>

            {/* Trading Card - Placeholder */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="p-5 border-b border-zinc-800">
                    <h2 className="font-semibold">Trade</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Buy YES or NO shares (Panta integration coming soon)
                    </p>
                </div>

                <div className="p-5 space-y-5">
                    {/* Amount input */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Amount (USDC)</label>
                        <input
                            type="number"
                            placeholder="10.00"
                            className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-violet-500"
                            disabled
                        />
                    </div>

                    {/* YES / NO buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            disabled
                            className="py-3 rounded-lg bg-emerald-600/80 text-white font-medium opacity-60 cursor-not-allowed"
                        >
                            Buy YES
                        </button>
                        <button
                            disabled
                            className="py-3 rounded-lg bg-rose-600/80 text-white font-medium opacity-60 cursor-not-allowed"
                        >
                            Buy NO
                        </button>
                    </div>

                    <p className="text-xs text-zinc-500 text-center">
                        Full trading will be enabled after Panta buy flow is connected.
                    </p>
                </div>
            </div>
        </div>
    );
}