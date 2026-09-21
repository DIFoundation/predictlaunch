import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { errorResponse } from "@/lib/panta/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, question, description, category, imageUrl } = body ?? {};

    if (typeof wallet !== "string" || !wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }
    if (typeof question !== "string" || question.trim().length < 10) {
      return NextResponse.json(
        { error: "question is required (at least 10 characters)" },
        { status: 400 }
      );
    }

    // Only forward known fields -- this route must not be an open proxy to Panta.
    const result = await pantaServer.quoteCreateMarket({
      wallet,
      question: question.trim(),
      description: typeof description === "string" ? description.trim() : undefined,
      category: typeof category === "string" && category ? category : "crypto",
      imageUrl: typeof imageUrl === "string" && imageUrl ? imageUrl : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to quote market");
  }
}
