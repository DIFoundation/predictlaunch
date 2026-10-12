import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const body = await req.json();
    const { wallet, question, description, category, imageUrl, marketType, startTime, endTime } = body ?? {};

    if (typeof wallet !== "string" || !wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }
    if (typeof question !== "string" || question.trim().length < 10) {
      return NextResponse.json(
        { error: "question is required (at least 10 characters)" },
        { status: 400 }
      );
    }

    if (marketType !== undefined && marketType !== "standard" && marketType !== "breaking") {
      return NextResponse.json({ error: "marketType must be standard or breaking" }, { status: 400 });
    }

    if (startTime !== undefined && (!Number.isSafeInteger(startTime) || startTime <= 0)) {
      return NextResponse.json({ error: "startTime must be a positive Unix timestamp in seconds" }, { status: 400 });
    }
    if (endTime !== undefined && (!Number.isSafeInteger(endTime) || endTime <= 0)) {
      return NextResponse.json({ error: "endTime must be a positive Unix timestamp in seconds" }, { status: 400 });
    }

    // Only forward known fields -- this route must not be an open proxy to Panta.
    const result = await pantaServer.quoteCreateMarket({
      wallet,
      question: question.trim(),
      description: typeof description === "string" ? description.trim() : undefined,
      category: typeof category === "string" && category ? category : "crypto",
      imageUrl: typeof imageUrl === "string" && imageUrl ? imageUrl : undefined,
      marketType: marketType === "breaking" ? "breaking" : "standard",
      startTime: typeof startTime === "number" ? startTime : undefined,
      endTime: typeof endTime === "number" ? endTime : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to quote market");
  }
}
