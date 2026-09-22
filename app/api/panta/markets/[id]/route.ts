import { NextResponse } from "next/server";
import { loadMarket } from "@/lib/panta/load";
import { errorResponse } from "@/lib/panta/route-helpers";

export const dynamic = "force-dynamic";

/** Normalized single market (catalog row + live prices), used by the launch page and portfolio. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const market = await loadMarket(id);
    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
    return NextResponse.json(market);
  } catch (err) {
    return errorResponse(err, "Failed to load market");
  }
}
