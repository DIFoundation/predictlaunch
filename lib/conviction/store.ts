import { LaunchRecord } from "@/types/conviction";

/**
 * Small browser cache (localStorage) for app-only metadata about launches, plus a
 * list of token mints the user has opened/traded (so the portfolio can show
 * their live on-chain balances). On-chain data is never cached here.
 * Exposed as an external store for useSyncExternalStore (SSR-safe).
 */
const KEY = "predictlaunch:launches:v2";
const MINTS_KEY = "predictlaunch:mints:v1";
const EMPTY: LaunchRecord[] = [];
const EMPTY_MINTS: string[] = [];

let cache: LaunchRecord[] | null = null;
let mintsCache: string[] | null = null;
const listeners = new Set<() => void>();

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked/full: keep the in-memory copy */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cache = null;
    if (e.key === MINTS_KEY) mintsCache = null;
    if (e.key === KEY || e.key === MINTS_KEY) emit();
  });
}

export const launchStore = {
  getSnapshot(): LaunchRecord[] {
    if (cache === null) cache = readJson(KEY, EMPTY);
    return cache;
  },
  getServerSnapshot(): LaunchRecord[] {
    return EMPTY;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getByMint(mint: string): LaunchRecord | undefined {
    return this.getSnapshot().find((l) => l.mint === mint);
  },
  add(launch: LaunchRecord) {
    const next = [launch, ...this.getSnapshot().filter((l) => l.mint !== launch.mint)];
    cache = next;
    write(KEY, next);
    emit();
  },

  // ---- mints the user has interacted with ----
  getMintsSnapshot(): string[] {
    if (mintsCache === null) mintsCache = readJson(MINTS_KEY, EMPTY_MINTS);
    return mintsCache;
  },
  getMintsServerSnapshot(): string[] {
    return EMPTY_MINTS;
  },
  rememberMint(mint: string) {
    const cur = this.getMintsSnapshot();
    if (cur.includes(mint)) return;
    mintsCache = [mint, ...cur].slice(0, 50);
    write(MINTS_KEY, mintsCache);
    emit();
  },
};
