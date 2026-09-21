import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await pantaServer.registerMarket(body);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register market" },
      { status: 500 }
    );
  }
}