/**
 * GUESSED, like trade-spec.ts. Panta's schema confirms only:
 *   POST /markets/create/image-upload/  "Issue one scoped direct-upload signature;
 *                                         image bytes never hit this API."
 * "Image bytes never hit this API" means the upload target is a different host (likely
 * S3 or similar) -- we do not know its request/response shape. This parses several common
 * presigned-upload shapes defensively; anything else is reported as unrecognised so the UI
 * can fall back to a manual image URL instead of silently failing.
 */

export interface UploadSignatureRequest {
  filename: string;
  contentType: string;
}

export type ParsedUploadTarget =
  | { kind: "presigned-post"; url: string; fields: Record<string, string>; publicUrl: string | null }
  | { kind: "presigned-put"; url: string; headers: Record<string, string>; publicUrl: string | null }
  | { kind: "unknown" };

// GUESS: field names. If Panta answers 400, /api/panta/probe (dev) shows the required fields.
export function buildUploadRequestBody(i: UploadSignatureRequest) {
  return { filename: i.filename, contentType: i.contentType };
}

function firstString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return null;
}

export function parseUploadResponse(raw: unknown): ParsedUploadTarget {
  if (!raw || typeof raw !== "object") return { kind: "unknown" };
  const o = raw as Record<string, unknown>;
  const publicUrl = firstString(o, ["publicUrl", "fileUrl", "cdnUrl", "imageUrl", "objectUrl", "downloadUrl"]);

  // Presigned S3-style POST: { url, fields: {...} }
  if (o.fields && typeof o.fields === "object") {
    const url = firstString(o, ["url", "uploadUrl", "postUrl"]);
    if (url) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(o.fields as Record<string, unknown>)) {
        if (typeof v === "string") fields[k] = v;
      }
      return { kind: "presigned-post", url, fields, publicUrl };
    }
  }

  // Presigned PUT: { uploadUrl | url | putUrl, headers? }
  const putUrl = firstString(o, ["uploadUrl", "putUrl", "url", "signedUrl"]);
  if (putUrl) {
    const headers: Record<string, string> = {};
    if (o.headers && typeof o.headers === "object") {
      for (const [k, v] of Object.entries(o.headers as Record<string, unknown>)) {
        if (typeof v === "string") headers[k] = v;
      }
    }
    return { kind: "presigned-put", url: putUrl, headers, publicUrl };
  }

  return { kind: "unknown" };
}

/** Perform the upload against a parsed target. Throws with a message safe to show the user. */
export async function uploadToTarget(target: ParsedUploadTarget, file: File): Promise<string> {
  if (target.kind === "unknown") {
    throw new Error("Panta's upload response wasn't in a recognised format. Paste an image URL manually instead.");
  }
  if (target.kind === "presigned-post") {
    const form = new FormData();
    for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
    form.append("file", file);
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed (${res.status}). Paste an image URL manually instead.`);
  } else {
    const res = await fetch(target.url, { method: "PUT", body: file, headers: { "Content-Type": file.type, ...target.headers } });
    if (!res.ok) throw new Error(`Upload failed (${res.status}). Paste an image URL manually instead.`);
  }
  if (!target.publicUrl) {
    throw new Error("Upload may have succeeded, but Panta's response had no public URL. Paste an image URL manually instead.");
  }
  return target.publicUrl;
}
