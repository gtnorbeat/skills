/**
 * Files — /api/files
 *
 * Upload, serve, and delete files in the R2 bucket (r2-aura).
 *
 * POST   /api/files/upload    — upload a file (multipart/form-data)
 * GET    /api/files/:key       — serve a file by key
 * DELETE /api/files/:key       — delete a file by key
 * POST   /api/files/cleanup    — delete files older than N days
 *
 * The R2 bucket stores artwork, contract PDFs, avatar photos, and other
 * label assets. The key format is:  {type}/{entityId}/{filename}
 * e.g.  "artwork/artist-abc123/cover.jpg",  "contracts/contract-xyz/agreement.pdf"
 *
 * Every uploaded file gets an `uploadedAt` ISO timestamp in its
 * customMetadata so the cleanup endpoint (called by a scheduled cron
 * trigger or manually) can age out old files.
 */
import type { Env } from "../env.js";
import { jsonError, jsonOk, jsonBadRequest, jsonNotFound, jsonCreated, CorsHeaders } from "./helpers.js";

/** Maximum allowed upload size — 25 MiB. */
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

/** Default age threshold for cleanup — 90 days. */
const CLEANUP_AGE_DAYS = 90;

/** Mapping of file extensions to MIME types for proper Content-Type headers. */
const MIME_TYPES: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".avif": "image/avif",
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".flac": "audio/flac",
  ".aiff": "audio/aiff",
  ".wma":  "audio/x-ms-wma",
  ".mp4":  "video/mp4",
  ".mov":  "video/quicktime",
  ".zip":  "application/zip",
  ".json": "application/json",
  ".txt":  "text/plain",
  ".csv":  "text/csv",
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".ttf":  "font/ttf",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

/** Guess the MIME type from a filename. Falls back to application/octet-stream. */
function mimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

/** Sanitise a filename — strip path separators and control characters. */
function sanitiseFilename(name: string): string {
  return name
    .replace(/[^ -~]/g, "_")
    .replace(/[/\\:<>"|?*]/g, "_")
    .trim() || "unnamed";
}

/**
 * Build standard CORS + security headers for file serving responses.
 * GET responses return binary/file content (not JSON), so they need
 * their own header set distinct from the JSON corsHeaders.
 */
function fileResponseHeaders(contentType: string, etag: string, size: number): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Length": String(size),
    "Cache-Control": "public, max-age=31536000, immutable",
    "ETag": etag,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Enforce the upload size limit. Returns an error response if the
 * payload exceeds MAX_UPLOAD_SIZE, or null if it's within bounds.
 */
function checkUploadSize(size: number, corsHeaders: CorsHeaders): Response | null {
  if (size > MAX_UPLOAD_SIZE) {
    const limitMB = MAX_UPLOAD_SIZE / (1024 * 1024);
    return new Response(
      JSON.stringify({
        status: "error",
        message: `File too large — maximum upload size is ${limitMB} MB`,
        maxSize: MAX_UPLOAD_SIZE,
        actualSize: size,
      }),
      { status: 413, headers: corsHeaders },
    );
  }
  return null;
}

export async function filesHandler(req: Request, env: Env, corsHeaders: CorsHeaders, url: URL): Promise<Response> {
  const bucket = env.R2_BUCKET;
  if (!bucket) {
    return jsonError("R2 storage not available", corsHeaders);
  }

  const pathParts = url.pathname.replace("/api/files", "").split("/").filter(Boolean);
  const action = pathParts[0] ?? null;

  try {
    // ── POST /api/files/cleanup — age-based deletion ─────────────
    if (req.method === "POST" && action === "cleanup") {
      const daysParam = url.searchParams.get("days");
      const maxAgeDays = daysParam ? parseInt(daysParam, 10) : CLEANUP_AGE_DAYS;
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

      let deleted = 0;
      let cursor: string | undefined;

      do {
        const listed = await bucket.list({ cursor, limit: 500 });
        for (const obj of listed.objects) {
          const uploadedAt = obj.customMetadata?.uploadedAt;
          if (uploadedAt) {
            const uploadedTime = new Date(uploadedAt).getTime();
            if (uploadedTime < cutoff) {
              await bucket.delete(obj.key);
              deleted++;
            }
          }
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      console.log(`[api] Cleanup: deleted ${deleted} files older than ${maxAgeDays} days`);
      return jsonOk({
        status: "ok",
        deleted,
        maxAgeDays,
        cutoff: new Date(cutoff).toISOString(),
      }, corsHeaders);
    }

    // ── POST /api/files/upload ──────────────────────────────────
    if (req.method === "POST" && action === "upload") {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        // If not multipart, try reading raw body as a file upload
        // with ?filename= and ?folder= query params
        const filename = url.searchParams.get("filename") || "unnamed";
        const folder = url.searchParams.get("folder") || "misc";
        const entityId = url.searchParams.get("entityId") || "";

        const rawBody = await req.arrayBuffer();
        if (rawBody.byteLength === 0) {
          return jsonBadRequest("Empty file body", corsHeaders);
        }

        const sizeErr = checkUploadSize(rawBody.byteLength, corsHeaders);
        if (sizeErr) return sizeErr;

        const key = `${folder}/${entityId}/${Date.now()}-${sanitiseFilename(filename)}`;
        await bucket.put(key, rawBody, {
          httpMetadata: { contentType: mimeType(filename) },
          customMetadata: { uploadedAt: new Date().toISOString() },
        });

        console.log(`[api] Uploaded raw file: ${key} (${rawBody.byteLength} bytes)`);
        return jsonCreated({
          status: "ok",
          key,
          url: `/api/files/${key}`,
          size: rawBody.byteLength,
        }, corsHeaders);
      }

      const fileField = formData.get("file");
      if (!fileField || !(fileField instanceof File)) {
        return jsonBadRequest("Missing 'file' field in multipart form data", corsHeaders);
      }

      const file = fileField as File;
      const folder = (formData.get("folder") as string) || "misc";
      const entityId = (formData.get("entityId") as string) || "";
      const filename = sanitiseFilename(file.name);
      const key = `${folder}/${entityId}/${Date.now()}-${filename}`;

      const buffer = await file.arrayBuffer();
      const sizeErr = checkUploadSize(buffer.byteLength, corsHeaders);
      if (sizeErr) return sizeErr;

      await bucket.put(key, buffer, {
        httpMetadata: { contentType: file.type || mimeType(filename) },
        customMetadata: { uploadedAt: new Date().toISOString() },
      });

      console.log(`[api] Uploaded file: ${key} (${buffer.byteLength} bytes, ${file.type})`);
      return jsonCreated({
        status: "ok",
        key,
        url: `/api/files/${key}`,
        filename,
        size: buffer.byteLength,
        contentType: file.type || mimeType(filename),
      }, corsHeaders);
    }

    // ── GET /api/files/:key — serve file from R2 ────────────────
    if (req.method === "GET" && action && action !== "upload" && action !== "cleanup") {
      const key = pathParts.join("/");

      const object = await bucket.get(key);
      if (!object) {
        return jsonNotFound("File not found in R2", corsHeaders);
      }

      // If the browser sends If-None-Match, return 304 Not Modified
      if (req.headers.get("If-None-Match") === object.httpEtag) {
        return new Response(null, {
          status: 304,
          headers: {
            "ETag": object.httpEtag,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const headers = fileResponseHeaders(
        object.httpMetadata?.contentType ?? mimeType(key),
        object.httpEtag,
        object.size,
      );

      return new Response(object.body as ReadableStream, { status: 200, headers });
    }

    // ── DELETE /api/files/:key — delete file from R2 ────────────
    if (req.method === "DELETE" && action && action !== "upload" && action !== "cleanup") {
      const key = pathParts.join("/");

      const existing = await bucket.get(key);
      if (!existing) {
        return jsonNotFound("File not found in R2", corsHeaders);
      }

      await bucket.delete(key);
      console.log(`[api] Deleted file: ${key}`);
      return jsonOk({ status: "ok", key }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Files error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

/** Exported for the scheduled cleanup handler (cron trigger). */
export async function cleanupHandler(env: Env): Promise<void> {
  const bucket = env.R2_BUCKET;
  if (!bucket) {
    console.warn("[cleanup] R2 bucket not available — skipping");
    return;
  }

  const cutoff = Date.now() - CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ cursor, limit: 500 });
    for (const obj of listed.objects) {
      const uploadedAt = obj.customMetadata?.uploadedAt;
      if (uploadedAt) {
        const uploadedTime = new Date(uploadedAt).getTime();
        if (uploadedTime < cutoff) {
          await bucket.delete(obj.key);
          deleted++;
        }
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  console.log(`[cleanup] Scheduled cleanup: deleted ${deleted} files older than ${CLEANUP_AGE_DAYS} days`);
}
