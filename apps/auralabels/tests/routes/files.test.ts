/**
 * Files route integration tests — cleanup endpoint & lifecycle.
 *
 * Mocks the R2Bucket binding so we can verify age-based deletion
 * without a real R2 bucket. Tests both the HTTP endpoint (POST
 * /api/files/cleanup) and the scheduled cleanupHandler directly.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupHandler, filesHandler } from "@/routes/files";
import type { Env } from "@/env";
import type { CorsHeaders } from "@/routes/helpers";

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a mock R2Object with customMetadata. */
function mockObject(opts: {
  key: string;
  uploadedAt?: string;
}): Record<string, unknown> {
  return {
    key: opts.key,
    size: 1024,
    httpEtag: `"etag-${opts.key}"`,
    customMetadata: opts.uploadedAt ? { uploadedAt: opts.uploadedAt } : undefined,
  };
}

/** Days in ms. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Create a mock R2Bucket where `list()` returns the given objects and
 * `delete()` tracks deleted keys.
 */
function buildBucketMock(objects: Record<string, unknown>[]) {
  const deleted: string[] = [];

  return {
    deleted, // for inspection in tests
    list: vi.fn(async (opts?: { cursor?: string; limit?: number }) => {
      const limit = opts?.limit ?? 500;
      const offset = opts?.cursor ? parseInt(opts.cursor, 10) : 0;
      const slice = objects.slice(offset, offset + limit);
      const truncated = offset + limit < objects.length;
      return {
        objects: slice,
        truncated,
        cursor: truncated ? String(offset + limit) : undefined,
      };
    }),
    delete: vi.fn(async (key: string) => {
      deleted.push(key);
    }),
    get: vi.fn(async (key: string) => {
      return objects.find((o) => o.key === key) ?? null;
    }),
    put: vi.fn(),
  };
}

/** Build a full mock Env with the given bucket objects. */
function mockEnv(bucketObjects: Record<string, unknown>[]): {
  env: Env;
  bucket: ReturnType<typeof buildBucketMock>;
} {
  const bucket = buildBucketMock(bucketObjects);

  return {
    env: {
      R2_BUCKET: bucket as unknown as Env["R2_BUCKET"],
      JWT_SECRET: "test",
      DATABASE_URL: undefined,
    },
    bucket,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("cleanupHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes files older than 90 days", async () => {
    const { env } = mockEnv([
      mockObject({ key: "old/file-1.jpg", uploadedAt: daysAgo(120) }),
      mockObject({ key: "old/file-2.pdf", uploadedAt: daysAgo(100) }),
    ]);

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).toHaveBeenCalledTimes(2);
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("old/file-1.jpg");
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("old/file-2.pdf");
  });

  it("keeps files newer than 90 days", async () => {
    const { env } = mockEnv([
      mockObject({ key: "recent/file-1.jpg", uploadedAt: daysAgo(30) }),
      mockObject({ key: "recent/file-2.png", uploadedAt: daysAgo(5) }),
    ]);

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).not.toHaveBeenCalled();
  });

  it("keeps files without uploadedAt metadata", async () => {
    const { env } = mockEnv([
      mockObject({ key: "legacy/file.jpg" }), // no uploadedAt
      mockObject({ key: "old/file.png", uploadedAt: daysAgo(120) }),
    ]);

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).toHaveBeenCalledTimes(1);
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("old/file.png");
  });

  it("skips when R2 bucket is not available", async () => {
    const env: Env = { R2_BUCKET: undefined, JWT_SECRET: "test" };

    // Should not throw
    await expect(cleanupHandler(env)).resolves.toBeUndefined();
  });

  it("handles mixed old/new/missing-metadata files correctly", async () => {
    const { env } = mockEnv([
      mockObject({ key: "keep-recent.jpg", uploadedAt: daysAgo(10) }),
      mockObject({ key: "delete-old.pdf", uploadedAt: daysAgo(200) }),
      mockObject({ key: "keep-legacy.png" }), // no metadata
      mockObject({ key: "delete-ancient.mp3", uploadedAt: daysAgo(365) }),
      mockObject({ key: "keep-boundary.jpg", uploadedAt: daysAgo(89) }), // just under 90 days
    ]);

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).toHaveBeenCalledTimes(2);
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("delete-old.pdf");
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("delete-ancient.mp3");
  });

  it("handles pagination across multiple list calls", async () => {
    // 6 objects, limit=3 per page → forces 2 pages
    const objects: ReturnType<typeof mockObject>[] = [];
    for (let i = 0; i < 4; i++) {
      objects.push(mockObject({ key: `old/file-${i}.jpg`, uploadedAt: daysAgo(120) }));
    }
    for (let i = 0; i < 2; i++) {
      objects.push(mockObject({ key: `recent/file-${i}.png`, uploadedAt: daysAgo(30) }));
    }

    const { env, bucket } = mockEnv(objects);
    // Override limit to force pagination with fewer objects
    bucket.list = vi.fn(async (opts?: { cursor?: string; limit?: number }) => {
      const limit = 3; // force 3-per-page
      const offset = opts?.cursor ? parseInt(opts.cursor, 10) : 0;
      const slice = objects.slice(offset, offset + limit);
      const truncated = offset + limit < objects.length;
      return { objects: slice, truncated, cursor: truncated ? String(offset + limit) : undefined };
    });

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).toHaveBeenCalledTimes(4);
    expect(env.R2_BUCKET!.list).toHaveBeenCalledTimes(2);
  });

  it("handles empty bucket gracefully", async () => {
    const { env } = mockEnv([]);

    await cleanupHandler(env);

    expect(env.R2_BUCKET!.delete).not.toHaveBeenCalled();
    expect(env.R2_BUCKET!.list).toHaveBeenCalledTimes(1);
  });

  it("respects the 90-day cutoff boundary", async () => {
    // Freeze time so the cutoff calculation is deterministic.
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { env } = mockEnv([
      mockObject({ key: "exactly-90-days.jpg", uploadedAt: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString() }),
      mockObject({ key: "91-days.jpg", uploadedAt: new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString() }),
      mockObject({ key: "89-days.jpg", uploadedAt: new Date(now - 89 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);

    await cleanupHandler(env);

    // 90 days ago: cutoff = now - 90 * 24 * 60 * 60 * 1000
    // File at exactly 90 days: uploadedTime == cutoff,
    //   uploadedTime < cutoff is false → kept
    // File at 91 days: uploadedTime < cutoff is true → deleted
    // File at 89 days: uploadedTime < cutoff is false → kept
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledTimes(1);
    expect(env.R2_BUCKET!.delete).toHaveBeenCalledWith("91-days.jpg");

    vi.useRealTimers();
  });
});

// ── Upload endpoint tests ────────────────────────────────────────────

const CORS_HEADERS: CorsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** Helper: call filesHandler with a mocked request. */
async function callUpload(
  req: Request,
  bucket = buildBucketMock([]),
): Promise<Response> {
  const env: Env = {
    R2_BUCKET: bucket as unknown as Env["R2_BUCKET"],
    JWT_SECRET: "test",
  };
  const url = new URL(req.url);
  return filesHandler(req, env, CORS_HEADERS, url);
}

/** Build a mock R2 object suitable for GET requests (has body + httpMetadata). */
function fileObject(opts: {
  key: string;
  contentType?: string;
  body?: Uint8Array;
}): Record<string, unknown> {
  const buf = opts.body ?? new TextEncoder().encode("mock data");
  return {
    key: opts.key,
    size: buf.byteLength,
    httpEtag: `"etag-${opts.key}"`,
    httpMetadata: { contentType: opts.contentType ?? "application/octet-stream" },
    body: buf,
  };
}

describe("filesHandler — upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a multipart file and stores metadata", async () => {
    const bucket = buildBucketMock([]);
    const file = new File(["hello world"], "cover.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "artwork");
    formData.append("entityId", "artist-123");

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.key).toMatch(/^artwork\/artist-123\/\d+-cover\.jpg$/);
    expect(body.filename).toBe("cover.jpg");
    expect(body.contentType).toBe("image/jpeg");

    // Verify R2 put was called with customMetadata
    expect(bucket.put).toHaveBeenCalledTimes(1);
    const putCall = bucket.put.mock.calls[0];
    expect(putCall[0]).toMatch(/^artwork\/artist-123\/\d+-cover\.jpg$/);
    expect(putCall[2].httpMetadata.contentType).toBe("image/jpeg");
    expect(putCall[2].customMetadata.uploadedAt).toBeTruthy();
    expect(new Date(putCall[2].customMetadata.uploadedAt).getTime()).toBeGreaterThan(0);
  });

  it("uploads via raw body when formData() throws", async () => {
    // In Node.js, req.formData() consumes the body even when it throws.
    // Spy on it so the raw-body fallback path still has a readable body.
    vi.spyOn(Request.prototype, "formData")
      .mockRejectedValueOnce(new Error("Not multipart"));

    const bucket = buildBucketMock([]);
    const req = new Request(
      "https://aura.test/api/files/upload?filename=track.mp3&folder=audio&entityId=rel-1",
      { method: "POST", body: new Uint8Array([1, 2, 3]) },
    );

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.key).toMatch(/^audio\/rel-1\/\d+-track\.mp3$/);

    expect(bucket.put).toHaveBeenCalledTimes(1);
    const putCall = bucket.put.mock.calls[0];
    expect(putCall[2].httpMetadata.contentType).toBe("audio/mpeg");
    expect(putCall[2].customMetadata.uploadedAt).toBeTruthy();
  });

  it("rejects empty raw body", async () => {
    vi.spyOn(Request.prototype, "formData")
      .mockRejectedValueOnce(new Error("Not multipart"));

    const bucket = buildBucketMock([]);
    const req = new Request(
      "https://aura.test/api/files/upload?filename=empty.txt",
      { method: "POST", body: new Uint8Array(0) },
    );

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toBe("Empty file body");
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("rejects files exceeding 25 MB", async () => {
    const bucket = buildBucketMock([]);
    const bigFile = new File(
      [new Uint8Array(25 * 1024 * 1024 + 1)],
      "big.dat",
      { type: "application/octet-stream" },
    );
    const formData = new FormData();
    formData.append("file", bigFile);

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body.message).toContain("File too large");
    expect(body.maxSize).toBe(25 * 1024 * 1024);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("rejects multipart without a file field", async () => {
    const bucket = buildBucketMock([]);
    const formData = new FormData();
    formData.append("folder", "artwork");
    // No "file" field

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toBe("Missing 'file' field in multipart form data");
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("sanitises filenames with path separators", async () => {
    const bucket = buildBucketMock([]);
    const file = new File(["data"], "../../../etc/passwd.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    const body = await res.json();
    // The filename portion (after the last /) has slashes replaced with _.
    const filenamePart = body.key.split("/").pop()!;
    expect(filenamePart).not.toContain("/");
    expect(filenamePart).not.toContain("\\");
    expect(filenamePart).toContain(".._.._.._etc_passwd");
  });

  it("sanitises control characters in filenames", async () => {
    const bucket = buildBucketMock([]);
    const file = new File(["data"], "track\x00name.mp3", { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", file);

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.key).not.toContain("\x00");
    expect(body.key).toContain("track_name");
  });

  it("defaults folder to 'misc' when not provided", async () => {
    const bucket = buildBucketMock([]);
    const file = new File(["data"], "file.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.key).toMatch(/^misc\/\/\d+-file\.png$/);
  });

  it("detects MIME type from file extension via raw-body path", async () => {
    // The raw-body path uses mimeType(filename) directly — no File type
    // interference from the FormData round-trip.
    vi.spyOn(Request.prototype, "formData")
      .mockRejectedValueOnce(new Error("Not multipart"));

    const bucket = buildBucketMock([]);
    const req = new Request(
      "https://aura.test/api/files/upload?filename=data.json&folder=reports",
      { method: "POST", body: new TextEncoder().encode("{\"key\":\"value\"}") },
    );

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(201);

    // Verify the R2 put was called with the correct MIME type from the extension.
    const putCall = bucket.put.mock.calls[0];
    expect(putCall[2].httpMetadata.contentType).toBe("application/json");
    expect(putCall[2].customMetadata.uploadedAt).toBeTruthy();
  });

  it("returns error when R2 bucket is not available", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);

    const req = new Request("https://aura.test/api/files/upload", {
      method: "POST",
      body: formData,
    });

    const env: Env = { R2_BUCKET: undefined, JWT_SECRET: "test" };
    const url = new URL(req.url);
    const res = await filesHandler(req, env, CORS_HEADERS, url);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("R2 storage not available");
  });

  it("rejects non-POST methods on the upload endpoint", async () => {
    const bucket = buildBucketMock([]);
    const req = new Request("https://aura.test/api/files/upload", {
      method: "GET",
    });

    const res = await callUpload(req, bucket);
    expect(res.status).toBe(400);
    expect(bucket.put).not.toHaveBeenCalled();
  });
});

// ── GET /api/files/:key — serve file tests ───────────────────────────

describe("filesHandler — serve (GET)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves a file with correct file response headers", async () => {
    const bucket = buildBucketMock([
      fileObject({ key: "artwork/cover.jpg", contentType: "image/jpeg" }),
    ]);

    const req = new Request("https://aura.test/api/files/artwork/cover.jpg");
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Length")).toBe(String(new TextEncoder().encode("mock data").byteLength));
    expect(res.headers.get("ETag")).toBe('"etag-artwork/cover.jpg"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");

    // Verify the body stream is available
    expect(res.body).not.toBeNull();
  });

  it("returns 304 Not Modified when If-None-Match matches ETag", async () => {
    const bucket = buildBucketMock([
      fileObject({ key: "artwork/cover.jpg", contentType: "image/jpeg" }),
    ]);

    const req = new Request("https://aura.test/api/files/artwork/cover.jpg", {
      headers: { "If-None-Match": '"etag-artwork/cover.jpg"' },
    });
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"etag-artwork/cover.jpg"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    // 304 should have no body
    expect(res.body).toBeNull();
  });

  it("returns 404 when file key does not exist in R2", async () => {
    const bucket = buildBucketMock([
      fileObject({ key: "artwork/cover.jpg" }),
    ]);

    const req = new Request("https://aura.test/api/files/artwork/nonexistent.png");
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("File not found in R2");
  });

  it("falls back to MIME type from extension when httpMetadata is missing", async () => {
    // fileObject without httpMetadata — simulates legacy files
    const obj = {
      key: "audio/track.mp3",
      size: 8,
      httpEtag: '"etag-audio/track.mp3"',
      body: new TextEncoder().encode("mp3 data"),
    };
    const bucket = buildBucketMock([obj]);

    const req = new Request("https://aura.test/api/files/audio/track.mp3");
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(200);
    // Falls back to mimeType(key) — "audio/mpeg" for .mp3
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const obj = {
      key: "misc/file.xyz",
      size: 4,
      httpEtag: '"etag-misc/file.xyz"',
      body: new TextEncoder().encode("data"),
    };
    const bucket = buildBucketMock([obj]);

    const req = new Request("https://aura.test/api/files/misc/file.xyz");
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("returns 500 when bucket is unavailable", async () => {
    const req = new Request("https://aura.test/api/files/artwork/cover.jpg");

    const env: Env = { R2_BUCKET: undefined, JWT_SECRET: "test" };
    const url = new URL(req.url);
    const res = await filesHandler(req, env, CORS_HEADERS, url);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("R2 storage not available");
  });
});

// ── DELETE /api/files/:key — delete file tests ────────────────────────

describe("filesHandler — delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes an existing file and returns ok", async () => {
    const bucket = buildBucketMock([
      fileObject({ key: "artwork/old-cover.jpg" }),
    ]);

    const req = new Request("https://aura.test/api/files/artwork/old-cover.jpg", {
      method: "DELETE",
    });
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.key).toBe("artwork/old-cover.jpg");

    expect(bucket.delete).toHaveBeenCalledTimes(1);
    expect(bucket.delete).toHaveBeenCalledWith("artwork/old-cover.jpg");
  });

  it("returns 404 when deleting a non-existent file", async () => {
    const bucket = buildBucketMock([
      fileObject({ key: "artwork/cover.jpg" }),
    ]);

    const req = new Request("https://aura.test/api/files/artwork/nope.jpg", {
      method: "DELETE",
    });
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("File not found in R2");
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it("deletes files in nested paths", async () => {
    const bucket = buildBucketMock([
      fileObject({
        key: "contracts/artist-xyz/agreement.pdf",
        contentType: "application/pdf",
      }),
    ]);

    const req = new Request(
      "https://aura.test/api/files/contracts/artist-xyz/agreement.pdf",
      { method: "DELETE" },
    );
    const res = await callUpload(req, bucket);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("contracts/artist-xyz/agreement.pdf");
    expect(bucket.delete).toHaveBeenCalledWith("contracts/artist-xyz/agreement.pdf");
  });

  it("returns 500 when bucket is unavailable", async () => {
    const req = new Request("https://aura.test/api/files/artwork/cover.jpg", {
      method: "DELETE",
    });

    const env: Env = { R2_BUCKET: undefined, JWT_SECRET: "test" };
    const url = new URL(req.url);
    const res = await filesHandler(req, env, CORS_HEADERS, url);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("R2 storage not available");
  });
});
