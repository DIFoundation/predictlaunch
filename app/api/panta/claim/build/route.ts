import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { TRADE_SPEC } from "@/lib/panta/trade-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Build an unsigned claim transaction for a resolved market (Panta preflights claimability on-chain). */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { wallet, marketId } = (await req.json()) ?? {};
    if (typeof wallet !== "string" || !WALLET.test(wallet) || typeof marketId !== "string" || !marketId) {
      return NextResponse.json({ error: "valid wallet and marketId are required" }, { status: 400 });
    }
    return NextResponse.json(await pantaServer.claimBuild(TRADE_SPEC.claim({ wallet, marketId })));
  } catch (err) {
    return errorResponse(err, "Failed to build claim transaction");
  }
}
