"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MarketTrade } from "@/lib/panta/trades";

export function PriceHistoryChart({ trades }: { trades: MarketTrade[] }) {
  const priced = trades.filter((t) => t.price !== null);
  if (priced.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Not enough trade history yet to chart a price line.
      </div>
    );
  }

  const data = priced
    .slice()
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    .map((t) => ({ t: t.time ? new Date(t.time * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "", price: (t.price as number) * 100 }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-300">YES price history</h3>
        <span className="text-xs text-zinc-500">from Panta trades</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="t" stroke="#71717a" fontSize={10} minTickGap={40} />
          <YAxis stroke="#71717a" fontSize={11} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}¢`} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${Number(v).toFixed(1)}¢`, "YES"]}
          />
          <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
