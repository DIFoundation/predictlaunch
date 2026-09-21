import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { errorResponse } from "@/lib/panta/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const { createId, signature } = (await req.json()) ?? {};
    if (typeof createId !== "string" || typeof signature !== "string" || !createId || !signature) {
      return NextResponse.json(
        { error: "createId and signature are required" },
        { status: 400 }
      );
    }
    return NextResponse.json(await pantaServer.registerMarket({ createId, signature }));
  } catch (err) {
    return errorResponse(err, "Failed to register market");
  }
}
