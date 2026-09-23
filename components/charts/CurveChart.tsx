"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, CartesianGrid } from "recharts";
import type { CurvePoint } from "@/lib/meteora/curveShape";

/**
 * The bonding curve's real shape (price vs. SOL raised), computed from the pool's own config --
 * not history, not a guess. `current` marks where the live pool actually sits on that line.
 */
export function CurveChart({ points, current }: { points: CurvePoint[]; current: { quoteReserveSol: number; priceSol: number } }) {
  if (points.length < 2) return null;
  const data = points.map((p) => ({ x: p.quoteReserveSol, y: p.priceSol }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-300">Bonding curve</h3>
        <span className="text-xs text-zinc-500">price vs. SOL raised</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="x"
            stroke="#71717a"
            fontSize={11}
            tickFormatter={(v: number) => `${v.toFixed(0)}`}
            label={{ value: "SOL raised", position: "insideBottom", offset: -2, fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            width={64}
            tickFormatter={(v: number) => v.toPrecision(2)}
            scale="log"
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => `${Number(v).toFixed(2)} SOL raised`}
            formatter={(v) => [`${Number(v).toPrecision(4)} SOL`, "price"]}
          />
          <Area type="monotone" dataKey="y" stroke="#8b5cf6" strokeWidth={2} fill="url(#curveFill)" isAnimationActive={false} />
          <ReferenceDot x={current.quoteReserveSol} y={current.priceSol} r={5} fill="#22c55e" stroke="#0a0a0a" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-500 mt-1">Green dot = current price and SOL raised so far.</p>
    </div>
  );
}
