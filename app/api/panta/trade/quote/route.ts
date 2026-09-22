import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { TRADE_SPEC } from "@/lib/panta/trade-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Step 1 of an in-app buy: preview the fill and get a quoteId. Spends nothing. */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { wallet, marketId, side, amountUsdc } = (await req.json()) ?? {};
    if (typeof wallet !== "string" || !WALLET.test(wallet)) {
      return NextResponse.json({ error: "valid wallet is required" }, { status: 400 });
    }
    if (typeof marketId !== "string" || !marketId) {
      return NextResponse.json({ error: "marketId is required" }, { status: 400 });
    }
    if (side !== "yes" && side !== "no") {
      return NextResponse.json({ error: "side must be 'yes' or 'no'" }, { status: 400 });
    }
    const amt = Number(amountUsdc);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 100_000) {
      return NextResponse.json({ error: "amountUsdc must be a positive number" }, { status: 400 });
    }
    return NextResponse.json(
      await pantaServer.primaryOrderQuote(TRADE_SPEC.quote({ wallet, marketId, side, amountUsdc: amt }))
    );
  } catch (err) {
    return errorResponse(err, "Failed to quote order");
  }
}
