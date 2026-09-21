"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { launchStore } from "@/lib/conviction/store";
import { levelForScore } from "@/lib/conviction/score";

function levelStyles(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (score >= 55) return "bg-violet-500/15 text-violet-400 border-violet-500/30";
  if (score >= 30) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-zinc-800 text-zinc-400 border-zinc-700";
}

export default function LaunchesPage() {
  const launches = useSyncExternalStore(
    launchStore.subscribe,
    launchStore.getSnapshot,
    launchStore.getServerSnapshot
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Launches</h1>
          <p className="text-zinc-400 mt-1">Tokens launched with conviction signals</p>
          <p className="text-xs text-zinc-600 mt-1">
            Stored in this browser (MVP). A shared database is on the roadmap.
          </p>
        </div>
        <Link
          href="/launch"
          className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
        >
          + Launch Token
        </Link>
      </div>

      {launches.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg">No launches yet</p>
          <p className="text-sm mt-2">Create a launch and optionally link a prediction market.</p>
          <Link
            href="/launch"
            className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition"
          >
            Launch Token
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {launches.map((l) => (
            <div
              key={l.id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">
                    {l.name} <span className="text-zinc-500 font-normal">(${l.symbol})</span>
                  </h3>
                  {l.description && (
                    <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{l.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-500">
                    <span>{new Date(l.createdAt).toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        l.mode === "onchain"
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {l.mode === "onchain" ? "on-chain" : "record only"}
                    </span>
                    {l.feeBps !== undefined && <span>fee {(l.feeBps / 100).toFixed(2)}%</span>}
                  </div>
                </div>
                <div
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${levelStyles(
                    l.convictionScore
                  )}`}
                >
                  {levelForScore(l.convictionScore)} · {l.convictionScore}
                </div>
              </div>

              {(l.linkedMarketIds.length > 0 || l.mint) && (
                <div className="mt-4 pt-3 border-t border-zinc-800 space-y-1 text-xs text-zinc-500">
                  {l.linkedMarketIds[0] && (
                    <p className="break-all">
                      Linked market:{" "}
                      <Link
                        href={`/markets/${l.linkedMarketIds[0]}`}
                        className="text-zinc-400 hover:text-white underline underline-offset-2"
                      >
                        {l.linkedMarketIds[0]}
                      </Link>
                    </p>
                  )}
                  {l.mint && (
                    <p className="break-all">
                      Mint: <code className="text-zinc-400">{l.mint}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
