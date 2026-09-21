import { NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { normalizeMarket } from "@/lib/panta/normalize";
import { errorResponse } from "@/lib/panta/route-helpers";
import type { PantaMarketRaw } from "@/types/panta";

export const dynamic = "force-dynamic";

/** Normalized single-market lookup, used by the launch page to compute real conviction. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const raw = (await pantaServer.getMarket(id)) as PantaMarketRaw;
    if (!raw || !raw.marketId) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    return NextResponse.json(normalizeMarket(raw));
  } catch (err) {
    return errorResponse(err, "Failed to load market");
  }
}
