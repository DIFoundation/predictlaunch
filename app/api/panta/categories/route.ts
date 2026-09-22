import { NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { extractCategories } from "@/lib/panta/normalize";
import { errorResponse } from "@/lib/panta/route-helpers";

export const dynamic = "force-dynamic";

/** Panta's category allowlist (used for create + list filters). */
export async function GET() {
  try {
    return NextResponse.json({ items: extractCategories(await pantaServer.getCategories()) });
  } catch (err) {
    return errorResponse(err, "Failed to load categories");
  }
}
