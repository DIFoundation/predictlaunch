import { runDiagnostics } from "@/lib/status";
import { CheckCircle2, CircleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const { network, checks } = await runDiagnostics();
  const allOk = checks.every((c) => c.ok);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">System status</h1>
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

      <ul className="grid gap-3 md:grid-cols-2">
        {checks.map((c) => (
          <li key={c.name} className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2">
              <span className={c.ok ? "text-emerald-300" : "text-red-400"}>{c.ok ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}</span>
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
