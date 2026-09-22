import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { TRADE_SPEC } from "@/lib/panta/trade-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

/**
 * Step 4 (after the user has signed + broadcast): register the signature with Panta, then
 * best-effort attribute the trade to this API key (POST /trades/). Attribution failing does
 * not fail the order: the funds already moved on-chain, so we report it separately.
 */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { quoteId, signature, wallet, marketId } = (await req.json()) ?? {};
    if (typeof quoteId !== "string" || typeof signature !== "string" || typeof wallet !== "string" || !quoteId || !signature || !wallet) {
      return NextResponse.json({ error: "quoteId, signature and wallet are required" }, { status: 400 });
    }
    const submit = await pantaServer.primaryOrderSubmit(TRADE_SPEC.submit({ quoteId, signature, wallet }));

    let attribution: { ok: boolean; result?: unknown; error?: string };
    try {
      attribution = {
        ok: true,
        result: await pantaServer.attributeTrade(TRADE_SPEC.attribute({ signature, wallet, marketId })),
      };
    } catch (e) {
      attribution = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    return NextResponse.json({ submit, attribution });
  } catch (err) {
    return errorResponse(err, "Failed to submit order");
  }
}
