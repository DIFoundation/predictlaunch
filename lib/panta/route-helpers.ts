import { NextRequest, NextResponse } from "next/server";
import { PantaError } from "@/lib/panta/server";

export function errorResponse(err: unknown, fallback: string) {
  if (err instanceof PantaError) {
    // Pass upstream status through so the UI can tell 4xx (bad payload) from 5xx.
    return NextResponse.json(
      { error: err.message, upstream: err.body ?? null },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Browser-only guard for routes that spend our Panta API key: reject cross-site callers.
 * (Requests without an Origin header, e.g. curl or server-to-server, are allowed through;
 * this stops other websites from driving our key from a visitor's browser.)
 */
export function crossOriginResponse(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) return null;
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
}
