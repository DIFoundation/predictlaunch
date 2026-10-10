import { NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { extractMarketList, isActiveMarket, normalizeMarket } from "@/lib/panta/normalize";
import { errorResponse } from "@/lib/panta/route-helpers";

export const dynamic = "force-dynamic";

/** Normalized live market list (used by the launch page's market picker). */
export async function GET() {
  try {
    const data = await pantaServer.listMarkets({ limit: 30 });
    const items = extractMarketList(data).map(normalizeMarket).filter(isActiveMarket);
    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err, "Failed to load markets");
  }
}
