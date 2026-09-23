import { NextRequest, NextResponse } from "next/server";
import { pantaServer } from "@/lib/panta/server";
import { buildUploadRequestBody, parseUploadResponse } from "@/lib/panta/upload-spec";
import { crossOriginResponse, errorResponse } from "@/lib/panta/route-helpers";

/**
 * Step 1 of an image upload: get a direct-upload signature from Panta. The actual bytes are
 * sent from the browser straight to the target URL this returns (never through our server --
 * matches Panta's own description that "image bytes never hit this API").
 */
export async function POST(req: NextRequest) {
  const blocked = crossOriginResponse(req);
  if (blocked) return blocked;
  try {
    const { filename, contentType } = (await req.json()) ?? {};
    if (typeof filename !== "string" || !filename || typeof contentType !== "string" || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "filename and an image contentType are required" }, { status: 400 });
    }
    const raw = await pantaServer.createImageUpload(buildUploadRequestBody({ filename, contentType }));
    const target = parseUploadResponse(raw);
    if (target.kind === "unknown") {
      return NextResponse.json({ error: "Unrecognised upload response from Panta", raw }, { status: 502 });
    }
    return NextResponse.json({ target });
  } catch (err) {
    return errorResponse(err, "Failed to get an upload URL");
  }
}
