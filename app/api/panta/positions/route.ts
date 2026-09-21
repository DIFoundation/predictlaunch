import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { errorResponse } from "@/lib/panta/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "valid wallet (base58) is required" }, { status: 400 });
  }
  try {
    const data = (await pantaServer.getPositions(wallet)) as unknown;
    const items = Array.isArray(data)
      ? data
      : ((data as { items?: unknown[]; results?: unknown[]; positions?: unknown[] })?.items ??
        (data as { results?: unknown[] })?.results ??
        (data as { positions?: unknown[] })?.positions ??
        []);
    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err, "Failed to load positions");
  }
}
