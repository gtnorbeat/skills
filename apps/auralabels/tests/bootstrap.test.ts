/**
 * Bootstrap admin integration test.
 *
 * Verifies that bootstrapAdminIfNeeded creates the admin user when the
 * users table is empty, skips when the user already exists, and that the
 * full login flow works after bootstrap.
 *
 * Mocks getDb() with an in-memory store (backed by a plain array) so the
 * tests run without a real Neon database. Uses real bcrypt for password
 * hashing/comparison so the crypto layer is actually exercised.
 *
 * NOTE: The mock DB's where() extracts the right-hand value from
 * Drizzle's eq() condition (via condition.right.value) to filter the
 * in-memory array. This depends on Drizzle's internal Param wrapper
 * but is the simplest way to make the mock behave correctly without
 * pulling in the full Drizzle query builder.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";

// ── Mock getDb ───────────────────────────────────────────────────────
const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));
vi.mock("@/db", () => ({ getDb }));

import {
  bootstrapAdminIfNeeded,
  resetBootstrapForTest,
} from "@/index";
import { loginHandler } from "@/routes/login";
import type { Env } from "@/env";
import { getDb as _getDb } from "@/db"; // used only for ReturnType type cast

// ── Mock Drizzle client builder ───────────────────────────────────────

interface MockUser {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  tenantId: string | null;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extract the right-hand value from a Drizzle eq() condition.
 * eq(column, value) produces a SQL object. In Drizzle 0.45.x the
 * user-supplied value lives inside a Param chunk ({value: "..."})
 * within the queryChunks array — it is NOT a plain string. We scan
 * for any chunk object with a `value` property that's a string.
 */
function extractEqValue(condition: unknown): unknown {
  if (condition && typeof condition === "object" && "queryChunks" in condition) {
    const chunks = (condition as Record<string, unknown>).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (typeof chunk === "string") return chunk;
        // Param chunks in Drizzle 0.45.x are objects like {value: "admin^"}
        if (chunk && typeof chunk === "object" && "value" in chunk) {
          const val = (chunk as Record<string, unknown>).value;
          if (typeof val === "string") return val;
        }
      }
    }
  }
  return undefined;
}

/** Creates a mock Drizzle client backed by an in-memory user array. */
function createMockDb(seed: MockUser[] = []) {
  const users: MockUser[] = [...seed];

  const mockDb = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: () => {
            const filterVal = extractEqValue(condition);
            const filtered = filterVal !== undefined
              ? users.filter((u) => u.username === filterVal)
              : [...users];
            return Promise.resolve(filtered);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (data: MockUser) => {
        users.push(data);
        return Promise.resolve();
      },
    }),
    /** Exposed for test assertions. */
    _users: users,
  };

  return mockDb;
}

// ── Helpers ───────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
} as const;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: "test-bootstrap-secret",
    BOOTSTRAP_ADMIN_USERNAME: "admin^",
    BOOTSTRAP_ADMIN_PASSWORD: "ADHDer4^Aur@",
    ...overrides,
  };
}

function loginRequest(username: string, password: string): Request {
  return new Request("https://aura.test/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("bootstrapAdminIfNeeded", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof _getDb>);
    resetBootstrapForTest();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates the admin user when the users table is empty", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users).toHaveLength(1);
    expect(mockDb._users[0].username).toBe("admin^");
    expect(mockDb._users[0].role).toBe("admin");
    expect(mockDb._users[0].disabled).toBe(false);

    const hash = mockDb._users[0].passwordHash;
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);

    const ok = await bcrypt.compare("ADHDer4^Aur@", hash);
    expect(ok).toBe(true);
  });

  it("does not create a duplicate when the admin user already exists", async () => {
    const existingHash = await bcrypt.hash("ADHDer4^Aur@", 10);
    mockDb._users.push({
      id: "existing-admin",
      username: "admin^",
      passwordHash: existingHash,
      role: "admin",
      tenantId: null,
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env = makeEnv();
    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users).toHaveLength(1);
    expect(mockDb._users[0].id).toBe("existing-admin");
  });

  it("skips bootstrap when BOOTSTRAP_ADMIN_USERNAME is missing", async () => {
    const env = makeEnv({ BOOTSTRAP_ADMIN_USERNAME: undefined });

    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users).toHaveLength(0);
  });

  it("skips bootstrap when BOOTSTRAP_ADMIN_PASSWORD is missing", async () => {
    const env = makeEnv({ BOOTSTRAP_ADMIN_PASSWORD: undefined });

    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users).toHaveLength(0);
  });

  it("skips bootstrap when DATABASE_URL is missing (getDb returns null)", async () => {
    vi.mocked(getDb).mockReturnValue(null);

    const env = makeEnv();
    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users).toHaveLength(0);
  });

  it("caches bootstrapPromise after successful creation", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);
    expect(mockDb._users).toHaveLength(1);

    mockDb._users.length = 0;

    await bootstrapAdminIfNeeded(env);
    expect(mockDb._users).toHaveLength(0);
  });

  it("does NOT cache bootstrapPromise when secrets are missing (retries next request)", async () => {
    const envMissing = makeEnv({ BOOTSTRAP_ADMIN_USERNAME: undefined });
    await bootstrapAdminIfNeeded(envMissing);
    expect(mockDb._users).toHaveLength(0);

    const envFull = makeEnv();
    await bootstrapAdminIfNeeded(envFull);
    expect(mockDb._users).toHaveLength(1);
  });

  it("handles bcrypt.hash cost factor 10 without timing out", async () => {
    const env = makeEnv();

    const start = Date.now();
    await bootstrapAdminIfNeeded(env);
    const elapsed = Date.now() - start;

    expect(mockDb._users).toHaveLength(1);
    expect(elapsed).toBeLessThan(2000);
  });

  it("generates unique user IDs", async () => {
    const freshDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(freshDb as unknown as ReturnType<typeof _getDb>);

    const env = makeEnv({ BOOTSTRAP_ADMIN_USERNAME: "admin-2" });

    await bootstrapAdminIfNeeded(env);

    expect(freshDb._users[0].id).toMatch(/^user-\d+-[a-z0-9]+$/);
  });
});

// ── Full login flow after bootstrap ──────────────────────────────────

describe("Login flow after bootstrap", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof _getDb>);
    resetBootstrapForTest();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("admin can log in with the bootstrapped credentials", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    const req = loginRequest("admin^", "ADHDer4^Aur@");
    const res = await loginHandler(req, env, CORS_HEADERS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.token).toBeTruthy();
    expect(body.token.split(".")).toHaveLength(3);
  });

  it("login fails with wrong password after bootstrap", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    const req = loginRequest("admin^", "wrong-password");
    const res = await loginHandler(req, env, CORS_HEADERS);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Invalid credentials");
  });

  it("login fails with non-existent username (dummy-hash path)", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    const req = loginRequest("ghost-user", "anything");
    const res = await loginHandler(req, env, CORS_HEADERS);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Invalid credentials");
  });

  it("login returns 400 when username is empty", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    const req = loginRequest("", "ADHDer4^Aur@");
    const res = await loginHandler(req, env, CORS_HEADERS);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Username and password are required");
  });

  it("login returns 503 when DB is unavailable", async () => {
    vi.mocked(getDb).mockReturnValue(null);

    const env = makeEnv();
    const req = loginRequest("admin^", "ADHDer4^Aur@");
    const res = await loginHandler(req, env, CORS_HEADERS);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe("Database not available");
  });

  it("bootstrap then login: user role is correctly stored as admin", async () => {
    const env = makeEnv();

    await bootstrapAdminIfNeeded(env);

    expect(mockDb._users[0].role).toBe("admin");

    const req = loginRequest("admin^", "ADHDer4^Aur@");
    const res = await loginHandler(req, env, CORS_HEADERS);
    expect(res.status).toBe(200);
  });

  it("bootstrap does not interfere with pre-existing non-admin users", async () => {
    // Push a pre-existing non-admin user into the mock DB (which is fresh
    // from beforeEach, with bootstrapPromise already reset).
    const existingHash = await bcrypt.hash("user-pass", 10);
    mockDb._users.push({
      id: "regular-user",
      username: "some-user",
      passwordHash: existingHash,
      role: "user",
      tenantId: null,
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env = makeEnv();
    await bootstrapAdminIfNeeded(env);

    // Should have both users: the pre-existing one + the bootstrapped admin.
    expect(mockDb._users).toHaveLength(2);
    const admin = mockDb._users.find((u) => u.username === "admin^");
    expect(admin).toBeTruthy();
    expect(admin!.role).toBe("admin");
  });
});
