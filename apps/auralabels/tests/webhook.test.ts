/**
 * Webhook endpoint integration tests.
 *
 * Tests webhookHandler with mock getDb (in-memory store) following
 * the same pattern as bootstrap.test.ts.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock getDb ───────────────────────────────────────────────────────
const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));
vi.mock("@/db", () => ({ getDb }));

import { webhookHandler } from "@/routes/webhook";
import type { Env } from "@/env";
import type { CorsHeaders } from "@/routes/helpers";

// ── In-memory demo store ─────────────────────────────────────────────

interface DemoRow {
  id: string;
  tenantId: string;
  artistName: string;
  trackTitle: string;
  genre: string;
  status: string;
  bpm?: number;
}

function createMockDb() {
  const demos: DemoRow[] = [];

  const mockDb = {
    insert: () => ({
      values: (data: DemoRow) => {
        demos.push(data);
        return Promise.resolve();
      },
    }),
    _demos: demos,
  };

  return mockDb;
}

// ── Helpers ───────────────────────────────────────────────────────────

const CORS_HEADERS: CorsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const VALID_UUID = "f243512f-a848-44d5-bbf5-5b49aaec935c";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: "test-secret",
    DATABASE_URL: "postgres://localhost:5432/test",
    ...overrides,
  };
}

function webhookRequest(
  body: Record<string, unknown>,
  uuid = VALID_UUID,
  ip?: string,
): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (ip) headers.set("CF-Connecting-IP", ip);

  return new Request(`https://aura.test/api/webhook/${uuid}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function webhookGetRequest(uuid = VALID_UUID): Request {
  return new Request(`https://aura.test/api/webhook/${uuid}`, {
    method: "GET",
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Webhook handler", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Method validation ──────────────────────────────────────────

  it("rejects GET with 405", async () => {
    const env = makeEnv();
    const req = webhookGetRequest();
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  // ── DB not available ───────────────────────────────────────────

  it("returns 500 when database is not available", async () => {
    vi.mocked(getDb).mockReturnValue(null as never);
    const env = makeEnv();
    const req = webhookRequest({ artistName: "Test", trackTitle: "Track" });
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(500);
  });

  // ── UUID validation ────────────────────────────────────────────

  it("returns 400 for invalid webhook UUID format", async () => {
    const env = makeEnv();
    const req = webhookRequest(
      { artistName: "Test", trackTitle: "Track" },
      "not-a-valid-uuid",
    );
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Invalid webhook UUID format");
  });

  // ── Missing required fields ─────────────────────────────────────

  it("returns 400 when artistName is missing", async () => {
    const env = makeEnv();
    const req = webhookRequest({ trackTitle: "A Track" });
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("artistName is required");
  });

  it("returns 400 when trackTitle is missing", async () => {
    const env = makeEnv();
    const req = webhookRequest({ artistName: "An Artist" });
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("trackTitle is required");
  });

  it("returns 400 when JSON body is invalid", async () => {
    const env = makeEnv();
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    const req = new Request(
      `https://aura.test/api/webhook/${VALID_UUID}`,
      { method: "POST", headers, body: "not-json" },
    );
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Invalid JSON body");
  });

  // ── Valid submission ────────────────────────────────────────────

  it("creates a demo with status 'new' on valid submission", async () => {
    const env = makeEnv();
    const req = webhookRequest({
      artistName: "Test Artist",
      trackTitle: "Test Track",
      genre: "Techno",
      artistEmail: "test@example.com",
      bpm: 128,
    });
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.demoId).toMatch(/^demo-/);

    expect(mockDb._demos).toHaveLength(1);
    expect(mockDb._demos[0].artistName).toBe("Test Artist");
    expect(mockDb._demos[0].trackTitle).toBe("Test Track");
    expect(mockDb._demos[0].genre).toBe("Techno");
    expect(mockDb._demos[0].status).toBe("new");
    expect(mockDb._demos[0].tenantId).toBe("default");
  });

  it("uses default values for empty optional fields", async () => {
    const env = makeEnv();
    const req = webhookRequest({
      artistName: "Minimal",
      trackTitle: "Minimal Track",
    });
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(201);

    expect(mockDb._demos[0].genre).toBe("");
    expect(mockDb._demos[0].bpm).toBe(0);
    expect(mockDb._demos[0].status).toBe("new");
  });

  // ── Rate limiting ───────────────────────────────────────────────

  it("enforces rate limiting — 30 OK, 31st returns 429", async () => {
    const env = makeEnv();
    // Fire 30 valid submissions from the same IP — all should be 201
    for (let i = 0; i < 30; i++) {
      const req = webhookRequest(
        { artistName: `Artist ${i}`, trackTitle: `Track ${i}` },
        VALID_UUID,
        "10.0.0.1",
      );
      const res = await webhookHandler(req, env, CORS_HEADERS);
      expect(res.status).toBe(201);
    }

    // 31st should be rate limited
    const req = webhookRequest(
      { artistName: "Over Limit", trackTitle: "Blocked" },
      VALID_UUID,
      "10.0.0.1",
    );
    const res = await webhookHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toBe("Too many submissions. Try again later.");
  });

  it("different IPs have independent rate limits", async () => {
    const env = makeEnv();
    // Exhaust rate limit for IP 10.0.0.2
    for (let i = 0; i < 30; i++) {
      const req = webhookRequest(
        { artistName: "A", trackTitle: "T" },
        VALID_UUID,
        "10.0.0.2",
      );
      const res = await webhookHandler(req, env, CORS_HEADERS);
      expect(res.status).toBe(201);
    }

    // IP 10.0.0.2 should now be rate limited
    const blocked = webhookRequest(
      { artistName: "Blocked", trackTitle: "Nope" },
      VALID_UUID,
      "10.0.0.2",
    );
    const blockedRes = await webhookHandler(blocked, env, CORS_HEADERS);
    expect(blockedRes.status).toBe(429);

    // Different IP should still work
    const ok = webhookRequest(
      { artistName: "Fresh IP", trackTitle: "Works" },
      VALID_UUID,
      "10.0.0.3",
    );
    const okRes = await webhookHandler(ok, env, CORS_HEADERS);
    expect(okRes.status).toBe(201);
  });
});
