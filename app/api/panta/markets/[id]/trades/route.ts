import { NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { normalizeTrades } from "@/lib/panta/trades";
import { errorResponse } from "@/lib/panta/route-helpers";

export const dynamic = "force-dynamic";

/** GET /markets/{id}/trades/ -- Panta's own trade history, normalized for charting. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const data = await pantaServer.getMarketTrades(id);
    return NextResponse.json({ items: normalizeTrades(data) });
  } catch (err) {
    return errorResponse(err, "Failed to load trade history");
  }
}
