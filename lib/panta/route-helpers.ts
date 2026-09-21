import { NextResponse } from "next/server";
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
