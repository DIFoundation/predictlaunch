import { LaunchRecord } from "@/types/conviction";

/**
 * MVP persistence: browser localStorage.
 * (The previous module-level array lived in JS memory and vanished on every
 * page refresh. localStorage survives reloads and needs no backend; swap for a
 * DB later.) Exposed as an external store so React components can subscribe
 * with useSyncExternalStore -- SSR-safe and no setState-in-effect.
 */
const KEY = "predictlaunch:launches:v1";
const EMPTY: LaunchRecord[] = [];

let cache: LaunchRecord[] | null = null;
const listeners = new Set<() => void>();

function read(): LaunchRecord[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LaunchRecord[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = null;
      emit();
    }
  });
}

export const launchStore = {
  /** Stable reference between changes (required by useSyncExternalStore). */
  getSnapshot(): LaunchRecord[] {
    if (cache === null) cache = read();
    return cache;
  },
  getServerSnapshot(): LaunchRecord[] {
    return EMPTY;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getAll(): LaunchRecord[] {
    return this.getSnapshot();
  },
  add(launch: LaunchRecord) {
    const next = [launch, ...this.getSnapshot()];
    cache = next;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full / blocked: keep in-memory copy */
    }
    emit();
  },
  clear() {
    cache = EMPTY;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    emit();
  },
};
