import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Minimal Metaplex-style token metadata JSON. The on-chain `uri` of a launched
 * token points here so wallets/explorers get a name, symbol and description
 * instead of a dead link. (Add an `image` field once you host a token image.)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return NextResponse.json({
    name: (p.get("name") || "").slice(0, 32),
    symbol: (p.get("symbol") || "").slice(0, 10),
    description: (p.get("description") || "").slice(0, 300),
    external_url: req.nextUrl.origin,
    attributes: [{ trait_type: "Launched via", value: "PredictLaunch" }],
  });
}
