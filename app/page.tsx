import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl leading-tight">
          The launchpad where{" "}
          <span className="text-violet-400">conviction</span> is measurable.
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-2xl">
          Communities create prediction markets about a token’s future. High
          conviction unlocks better launches on Meteora Dynamic Bonding Curve.
        </p>

        <div className="flex flex-wrap gap-4 mt-8">
          <Link
            href="/create"
            className="px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition"
          >
            Create Market
          </Link>
          <Link
            href="/markets"
            className="px-6 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 font-medium transition"
          >
            Explore Markets
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-semibold mb-8">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold mb-4">
              1
            </div>
            <h3 className="font-semibold mb-2">Create a Market</h3>
            <p className="text-sm text-zinc-400">
              Ask a clear question about a future token or milestone. Powered by
              Panta.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold mb-4">
              2
            </div>
            <h3 className="font-semibold mb-2">Build Conviction</h3>
            <p className="text-sm text-zinc-400">
              Traders buy YES or NO. Volume and probability become a public
              signal of demand.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold mb-4">
              3
            </div>
            <h3 className="font-semibold mb-2">Launch Better</h3>
            <p className="text-sm text-zinc-400">
              High conviction unlocks improved Meteora DBC parameters and
              priority access.
            </p>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="pb-8">
        <h2 className="text-2xl font-semibold mb-4">Built for the Crypto World’s Fair</h2>
        <p className="text-zinc-400 mb-6 max-w-2xl">
          PredictLaunch is designed to compete across multiple side tracks:
          Superteam Nigeria, Panta API, Meteora DBC, and RPC Fast.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
            Superteam Nigeria
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
            Panta API
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
            Meteora DBC
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
            RPC Fast
          </span>
        </div>
      </section>
    </div>
  );
}