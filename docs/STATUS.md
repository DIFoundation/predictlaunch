# Current Project Status

**Stage:** Hackathon MVP · **Legend:** ✅ verified · 🧪 implemented, needs an on-chain / live-key run · 🔴 not done

| Feature | Status | Notes |
|---|---|---|
| Next.js 16 + Tailwind + wallet connect (Phantom/Solflare) | ✅ | Builds clean; lint + typecheck pass |
| Dark theme on any OS setting | ✅ | Previously white page on light-mode devices |
| Mobile navigation | ✅ | Previously no nav below `md` |
| Markets list / detail from Panta | 🧪 | Verified against a mock Panta; needs a `pk_live_` key. Now dynamic (was frozen at build time) |
| Real market data in conviction score | 🧪 | `/launch` fetches the market via `/api/panta/markets/[id]`; "demo data" toggle is clearly labelled |
| Conviction score engine | ✅ | 7 unit cases pass; null price no longer scores as 50% |
| Conviction → curve parameter (trading fee) | ✅ | 200/150/100/50 bps by level, fed into the Meteora config |
| Meteora DBC config + single-tx pool creation | 🧪 | Config validates in the SDK; tx built offline (1.1 KB, signatures verify). Needs a devnet run |
| Panta create-market flow (quote→confirm→build→sign→register) | 🧪 | Paths/bodies fixed (`createId`, `/create/register/`); register body + image host need a live check |
| Launch history | ✅ | localStorage (per-browser) |
| Buy YES / NO | 🔴 | Placeholder removed; link out to Panta |
| Shared database / portfolio / Nigeria section | 🔴 | See TODO |

## Known limitations
1. Launch history is per-browser (no shared DB yet).
2. Token metadata has no image.
3. `/api/panta/quote` is unauthenticated; add rate limiting before a public launch.
