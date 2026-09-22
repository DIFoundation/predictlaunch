import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { TRADE_SPEC } from "@/lib/panta/trade-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

/** Step 2: build the unsigned transaction from a quoteId. */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { quoteId, wallet } = (await req.json()) ?? {};
    if (typeof quoteId !== "string" || !quoteId || typeof wallet !== "string" || !wallet) {
      return NextResponse.json({ error: "quoteId and wallet are required" }, { status: 400 });
    }
    return NextResponse.json(await pantaServer.primaryOrderBuild(TRADE_SPEC.build({ quoteId, wallet })));
  } catch (err) {
    return errorResponse(err, "Failed to build order transaction");
  }
}
