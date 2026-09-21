import { ConvictionResult } from "@/types/conviction";
import { feeBpsForScore } from "@/lib/conviction/score";

function levelColor(level: ConvictionResult["level"]) {
  switch (level) {
    case "Very High":
      return { text: "text-emerald-400", bar: "bg-emerald-500" };
    case "High":
      return { text: "text-violet-400", bar: "bg-violet-500" };
    case "Medium":
      return { text: "text-amber-400", bar: "bg-amber-500" };
    default:
      return { text: "text-zinc-400", bar: "bg-zinc-600" };
  }
}

export function ConvictionPanel({
  conviction,
  isDemo = false,
}: {
  conviction: ConvictionResult;
  /** True when the numbers are illustrative rather than read from a real market. */
  isDemo?: boolean;
}) {
  const c = levelColor(conviction.level);
  const feePct = (feeBpsForScore(conviction.score) / 100).toFixed(2);

  return (
    <div className="rounded-xl border border-zinc-700 overflow-hidden">
      <div className="px-5 py-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Conviction Score</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isDemo ? "Demo data — not a real market" : "Based on live Panta market activity"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight">
            {conviction.score}
            <span className="text-base text-zinc-500 font-normal">/100</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${c.text}`}>{conviction.level}</div>
        </div>
      </div>

      <div className="p-5 space-y-4 bg-zinc-900/40">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
            style={{ width: `${conviction.score}%` }}
          />
        </div>

        <ul className="text-sm text-zinc-400 space-y-1.5">
          {conviction.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-600">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        <div className="pt-3 border-t border-zinc-800 space-y-2">
          <p className="text-xs text-zinc-500">
            Curve base fee unlocked:{" "}
            <span className="text-zinc-200 font-medium">{feePct}%</span>
          </p>
          {conviction.unlockedBenefits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {conviction.unlockedBenefits.map((b) => (
                <span
                  key={b}
                  className="text-xs px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/20"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
