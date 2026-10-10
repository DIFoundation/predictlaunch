"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { MarketTrade } from "@/lib/panta/trades";

export function PriceHistoryChart({ trades }: { trades: MarketTrade[] }) {
  const priced = trades.filter((t) => t.price !== null);
  if (priced.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Not enough trade history yet to chart YES / NO price history.
      </div>
    );
  }

  const data = priced
    .slice()
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    .map((t) => ({ t: t.time ? new Date(t.time * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "", yes: (t.price as number) * 100, no: (1 - (t.price as number)) * 100 }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div><h3 className="text-sm font-semibold text-zinc-100">YES / NO price history</h3><p className="mt-1 text-xs text-zinc-500">Trade-derived YES price and complementary implied NO price</p></div>
        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">Trade history</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="t" stroke="#71717a" fontSize={10} minTickGap={40} />
          <YAxis stroke="#71717a" fontSize={11} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}¢`} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            formatter={(v, name) => [`${Number(v).toFixed(1)}¢`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          <Line type="monotone" dataKey="yes" name="YES" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="no" name="NO (implied)" stroke="#fb7185" strokeWidth={2} dot={false} strokeDasharray="5 4" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
