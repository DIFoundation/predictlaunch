import Link from "next/link";
import { ArrowDownRight, ArrowRight, BarChart3, CheckCircle2, Layers3, Rocket, Sparkles, Zap } from "lucide-react";

const STEPS = [
  { number: "01", icon: BarChart3, title: "Read the signal", text: "Explore active prediction markets and track YES/NO probabilities, volume, and market conviction." },
  { number: "02", icon: Layers3, title: "Build conviction", text: "Aggregate market breadth, consensus, and volume quality into a transparent score." },
  { number: "03", icon: Rocket, title: "Launch on-chain", text: "Use conviction to configure a Meteora Dynamic Bonding Curve launch on Solana." },
];

export default function HomePage() {
  return (
    <div className="space-y-20 pb-8">
      <section className="relative isolate overflow-hidden rounded-4xl border border-emerald-300/15 bg-zinc-950 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.19),transparent_40%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.12),transparent_42%)]" />
        <div className="pointer-events-none absolute -right-20 -top-20 -z-10 h-80 w-80 rounded-full border border-emerald-300/8 sm:h-104 sm:w-104" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/6 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.8)]" /> Solana signal launchpad
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Turn market conviction into <span className="text-emerald-300">on-chain momentum.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              PredictLaunch connects prediction-market signals to token launches. Read the market, understand the conviction score, then launch a token on Meteora DBC.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/markets" className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200">Explore markets <ArrowRight size={16} /></Link>
              <Link href="/launch" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-emerald-300/30 hover:bg-white/6">Launch a token <ArrowDownRight size={16} /></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-300" /> Explainable conviction</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-300" /> Solana-native</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-300" /> User-signed transactions</span>
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-white/8 bg-black/35 p-4 shadow-2xl shadow-emerald-950/20">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div><p className="text-xs text-zinc-500">CONVICTION ENGINE</p><p className="mt-1 font-semibold">Market signal</p></div>
                <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] p-2 text-emerald-200"><Zap size={18} /></span>
              </div>
              <div className="py-6">
                <div className="flex items-end justify-between"><span className="text-sm text-zinc-400">Illustrative score</span><span className="text-4xl font-semibold tracking-tight tabular-nums">61<span className="text-lg text-zinc-500">/100</span></span></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-[61%] rounded-full bg-linear-to-r from-emerald-500 to-lime-300" /></div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/4.5 p-3"><p className="text-[10px] uppercase tracking-wider text-emerald-300">YES signal</p><p className="mt-1 text-lg font-semibold">Market-led</p></div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/2.5 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Launch venue</p><p className="mt-1 text-lg font-semibold">Meteora DBC</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-zinc-500"><span>Signal → conviction → launch</span><Sparkles size={14} className="text-emerald-300" /></div>
            </div>
            <p className="mt-3 text-center text-[10px] text-zinc-600">Illustrative interface preview · not live market data</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">The workflow</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">From signal to launch</h2></div><span className="hidden text-xs text-zinc-500 sm:block">Three clear steps</span></div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ number, icon: Icon, title, text }) => (
            <div key={number} className="group rounded-2xl border border-white/[0.07] bg-zinc-900/35 p-5 transition hover:border-emerald-300/20 hover:bg-zinc-900/65 sm:p-6">
              <div className="flex items-center justify-between"><span className="text-xs font-mono text-zinc-600">{number}</span><span className="rounded-xl border border-emerald-300/15 bg-emerald-300/6 p-2.5 text-emerald-200"><Icon size={18} /></span></div>
              <h3 className="mt-6 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.07] bg-zinc-900/30 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Built for the Crypto World&apos;s Fair</p><h2 className="mt-2 text-xl font-semibold">Markets, conviction, and Solana infrastructure.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Panta market data, Meteora Dynamic Bonding Curve launches, and RPC Fast connectivity through one server-side relay.</p></div>
          <Link href="/status" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-emerald-300/25 sm:self-center">System status <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-400">{["Solana", "Panta API", "Meteora DBC", "RPC Fast"].map((name) => <span key={name} className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">{name}</span>)}</div>
      </section>
    </div>
  );
}
