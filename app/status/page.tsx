import { runDiagnostics } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const { network, checks } = await runDiagnostics();
  const allOk = checks.every((c) => c.ok);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System status</h1>
        <p className="text-zinc-400 mt-1">
          Live checks from the server for <b>{network}</b>. No secrets are shown.
        </p>
      </div>

      <div
        className={`p-3 rounded-lg border text-sm ${
          allOk
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
        }`}
      >
        {allOk ? "All checks passed." : "Some checks failed — details below."}
      </div>

      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.name} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✓" : "✗"}</span>
              <span className="font-medium">{c.name}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1 wrap-break-words">{c.detail}</p>
            {c.hint && <p className="text-sm text-amber-300 mt-1">{c.hint}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
