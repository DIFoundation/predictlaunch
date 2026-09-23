import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Minimal Metaplex-style token metadata JSON. The on-chain `uri` of a launched
 * token points here so wallets/explorers get a name, symbol, description and image.
 * `image` must be a public https URL (the on-chain URI budget is ~200 chars, so
 * lib/meteora/metadataUri.ts drops description/image, in that order, to fit it).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const image = p.get("image");
  return NextResponse.json({
    name: (p.get("name") || "").slice(0, 32),
    symbol: (p.get("symbol") || "").slice(0, 10),
    description: (p.get("description") || "").slice(0, 300),
    ...(image ? { image } : {}),
    external_url: req.nextUrl.origin,
    attributes: [{ trait_type: "Launched via", value: "PredictLaunch" }],
  });
}
