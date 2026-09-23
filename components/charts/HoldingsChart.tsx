"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#38bdf8", "#f97316"];

export function HoldingsChart({ holdings }: { holdings: { label: string; valueSol: number }[] }) {
  const data = holdings.filter((h) => h.valueSol > 0).sort((a, b) => b.valueSol - a.valueSol);
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-2">Holdings by value</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={(v: number) => v.toPrecision(2)} />
          <YAxis type="category" dataKey="label" stroke="#a1a1aa" fontSize={12} width={90} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${Number(v).toFixed(4)} SOL`, "value"]}
          />
          <Bar dataKey="valueSol" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
