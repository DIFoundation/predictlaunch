import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { TRADE_SPEC } from "@/lib/panta/trade-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

/** Status check for a submitted order. */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { quoteId, signature } = (await req.json()) ?? {};
    if (!quoteId && !signature) {
      return NextResponse.json({ error: "quoteId or signature is required" }, { status: 400 });
    }
    return NextResponse.json(await pantaServer.primaryOrderVerify(TRADE_SPEC.verify({ quoteId, signature })));
  } catch (err) {
    return errorResponse(err, "Failed to verify order");
  }
}
