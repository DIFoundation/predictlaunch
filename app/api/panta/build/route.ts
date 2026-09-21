import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { createId } = body;

    if (!createId) {
      return NextResponse.json({ error: "createId is required" }, { status: 400 });
    }

    const result = await pantaServer.buildCreateMarket(createId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to build transaction" },
      { status: 500 }
    );
  }
}