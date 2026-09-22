import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { createId } = (await req.json()) ?? {};
    if (typeof createId !== "string" || !createId) {
      return NextResponse.json({ error: "createId is required" }, { status: 400 });
    }
    return NextResponse.json(await pantaServer.buildCreateMarket(createId));
  } catch (err) {
    return errorResponse(err, "Failed to build transaction");
  }
}
