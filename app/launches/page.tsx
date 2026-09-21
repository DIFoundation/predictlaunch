"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { launchStore } from "@/lib/conviction/store";
import { LaunchRecord } from "@/types/conviction";

export default function LaunchesPage() {
  const [launches, setLaunches] = useState<LaunchRecord[]>([]);

  useEffect(() => {
    // Load from the simple store
    setLaunches(launchStore.getAll());
  }, []);

  function getLevelStyles(score: number) {
    if (score >= 75) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (score >= 55) return "bg-violet-500/15 text-violet-400 border-violet-500/30";
    if (score >= 30) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-zinc-800 text-zinc-400 border-zinc-700";
  }

  function getLevelLabel(score: number) {
    if (score >= 75) return "Very High";
    if (score >= 55) return "High";
    if (score >= 30) return "Medium";
    return "Low";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Launches</h1>
          <p className="text-zinc-400 mt-1">
            Tokens launched with conviction signals
          </p>
        </div>
        <Link
          href="/launch"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
        >
          + Launch Token
        </Link>
      </div>

      {launches.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg">No launches yet</p>
          <p className="text-sm mt-2">
            Create a launch and optionally link a prediction market.
          </p>
          <Link
            href="/launch"
            className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
          >
            Launch Token
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {launches.map((launch) => (
            <div
              key={launch.id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    {launch.name}{" "}
                    <span className="text-zinc-500 font-normal">
                      (${launch.symbol})
                    </span>
                  </h3>
                  {launch.description && (
                    <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                      {launch.description}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-2">
                    {new Date(launch.createdAt).toLocaleString()}
                  </p>
                </div>

                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getLevelStyles(
                    launch.convictionScore
                  )}`}
                >
                  {getLevelLabel(launch.convictionScore)} · {launch.convictionScore}
                </div>
              </div>

              {launch.linkedMarketIds.length > 0 && (
                <div className="mt-4 pt-3 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500">
                    Linked market:{" "}
                    <code className="text-zinc-400">{launch.linkedMarketIds[0]}</code>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}