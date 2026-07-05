/**
 * Tenant isolation integration tests.
 *
 * Verifies that route handlers scope every CRUD operation by the
 * authenticated user's tenantId. Uses a mock in-memory Drizzle
 * client so tests run without a real database.
 *
 * Tests pass the JwtPayload directly to handlers (the entry point
 * already authenticates before dispatching), so no JWT tokens
 * are needed.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { artistsHandler } from "@/routes/artists";
import { tasksHandler } from "@/routes/tasks";
import { releasesHandler } from "@/routes/releases";
import type { Env } from "@/env";
import type { CorsHeaders } from "@/routes/helpers";
import type { JwtPayload } from "@/auth";

// ── Test constants ──────────────────────────────────────────────────

const TENANT_A = "tenant-alpha";
const TENANT_B = "tenant-bravo";

const CORS: CorsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const NOW = new Date("2026-07-05T12:00:00Z");

// ── Mock getDb ─────────────────────────────────────────────────────

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db", () => ({ getDb }));

// ── Drizzle condition parser ───────────────────────────────────────

interface ParsedCondition {
  column: string;
  value: unknown;
}

/**
 * Parse Drizzle conditions (eq / and) into column→value pairs.
 * Drizzle 0.45.x stores conditions as SQL objects with `queryChunks`.
 *
 * eq(col, "x"):     queryChunks = [_, Column{name}, " = ", Placeholder{value}, _]
 * and(c1, c2):      queryChunks = ["(", nestedWrapper, ")"]
 *   nestedWrapper:  queryChunks = [c1, " and ", c2]  (each has own queryChunks)
 */
function parseConditions(condition: unknown): ParsedCondition[] {
  if (!condition || typeof condition !== "object") return [];
  const obj = condition as Record<string, unknown>;

  if (!Array.isArray(obj.queryChunks)) return [];
  const chunks = obj.queryChunks as unknown[];

  // ── Detect and(…): any chunk that wraps nested SQL objects ──
  // and(c1, c2): wrapper.queryChunks = [c1, " and ", c2] (each ci has queryChunks)
  // and(c1 only): wrapper.queryChunks = [empty, Column, " = ", Placeholder, empty]
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && "queryChunks" in (chunk as object)) {
      const nestedObj = chunk as Record<string, unknown>;
      const nestedChunks = nestedObj.queryChunks as unknown[];

      // Check for multi-condition and(): sub-chunks that are SQL objects
      const subConditions = nestedChunks.filter(
        (nc) => nc && typeof nc === "object" && "queryChunks" in (nc as object),
      );
      if (subConditions.length >= 2) {
        return subConditions.flatMap((sc) => parseConditions(sc));
      }

      // Check for single-condition and(): parse nested chunks as eq() directly
      const result = parseEqChunks(nestedChunks);
      if (result) return [result];
    }
  }

  // ── Plain eq(): find Column (has name) + Placeholder (has value) ──
  const result = parseEqChunks(chunks);
  return result ? [result] : [];
}

/** Parse a flat list of eq() queryChunks into a single {column, value} pair. */
function parseEqChunks(chunks: unknown[]): ParsedCondition | null {
  let columnName = "";
  let value: unknown = undefined;
  let foundValue = false;
  const skippable = new Set(["", " = ", " and ", "(", ")"]);

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;
    const c = chunk as Record<string, unknown>;
    if (typeof c.name === "string") {
      columnName = c.name;
    }
    if ("value" in c) {
      const v = c.value;
      if (typeof v === "string" && !skippable.has(v)) {
        value = v;
        foundValue = true;
      } else if (v !== undefined && v !== "" && !(typeof v === "string") && !skippable.has(String(v))) {
        value = v;
        foundValue = true;
      }
    }
  }

  return (columnName && foundValue) ? { column: columnName, value } : null;
}

// ── In-memory mock Drizzle client ────────────────────────────────────

type Store = Record<string, Record<string, unknown>[]>;

function createMockDb(seed: Store = {}) {
  const store: Store = {};
  for (const [name, rows] of Object.entries(seed)) {
    store[name] = rows.map((r) => ({ ...r }));
  }

  // Resolve table name from the Drizzle table object
  // Uses Symbol(drizzle:Name) — the table name key used by drizzle-orm.
  const DRIZZLE_NAME = Symbol.for("drizzle:Name");

  function tableName(t: Record<string | symbol, unknown>): string {
    return (t[DRIZZLE_NAME] as string | undefined) ?? String(t);
  }

  function filterRows(rows: Record<string, unknown>[], conds: ParsedCondition[]): Record<string, unknown>[] {
    if (conds.length === 0) return rows;
    return rows.filter((row) =>
      conds.every((c) =>
        row[c.column] === c.value ||
        (c.value instanceof Date && row[c.column] instanceof Date &&
          (row[c.column] as Date).getTime() === c.value.getTime()),
      ),
    );
  }

  function clone(row: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(row));
  }

  /** Convert camelCase keys to snake_case (for matching Drizzle column names). */
  function camelToSnake(s: string): string {
    return s.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
  }

  /** Add snake_case aliases for every camelCase key so queries match. */
  function addSnakeAliases(row: Record<string, unknown>): void {
    for (const key of Object.keys(row)) {
      if (/[A-Z]/.test(key)) {
        row[camelToSnake(key)] = row[key];
      }
    }
  }

  const db = {
    _store: store,

    select: () => ({
      from: (table: { _?: { name?: string } }) => {
        const name = tableName(table);
        let conditions: ParsedCondition[] = [];

        return {
          where: (cond: unknown) => {
            conditions = parseConditions(cond);
            return {
              limit: (n: number) =>
                Promise.resolve(filterRows(store[name] ?? [], conditions).slice(0, n).map(clone)),
              orderBy: (...cols: unknown[]) => {
                const firstCol = cols[0] as Record<string, string> | undefined;
                const col = firstCol?.name ?? "";
                let rows = filterRows(store[name] ?? [], conditions);
                if (col) {
                  rows = [...rows].sort((a, b) =>
                    String(a[col] ?? "").localeCompare(String(b[col] ?? "")),
                  );
                }
                return Promise.resolve(rows.map(clone));
              },
            };
          },
          orderBy: (...cols: unknown[]) => {
            const firstCol = cols[0] as Record<string, string> | undefined;
            const byCol = firstCol?.name ?? "";
            let rows = store[name] ?? [];
            if (byCol) {
              rows = [...rows].sort((a, b) =>
                String(a[byCol] ?? "").localeCompare(String(b[byCol] ?? "")),
              );
            }
            return Promise.resolve(rows.map(clone));
          },
        };
      },
    }),

    insert: (table: { _?: { name?: string } }) => {
      const name = tableName(table);
      if (!store[name]) store[name] = [];
      return {
        values: (data: Record<string, unknown>) => {
          const row = clone(data);
          addSnakeAliases(row);
          store[name].push(row);
          return Promise.resolve();
        },
      };
    },

    update: (table: { _?: { name?: string } }) => {
      const name = tableName(table);
      return {
        set: (data: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const conds = parseConditions(cond);
            for (const row of filterRows(store[name] ?? [], conds)) {
              Object.assign(row, data);
              addSnakeAliases(row);
            }
            return Promise.resolve();
          },
        }),
      };
    },

    delete: (table: { _?: { name?: string } }) => {
      const name = tableName(table);
      return {
        where: (cond: unknown) => {
          const conds = parseConditions(cond);
          const ids = new Set(filterRows(store[name] ?? [], conds).map((r) => r.id));
          store[name] = (store[name] ?? []).filter((r) => !ids.has(r.id));
          return Promise.resolve();
        },
      };
    },
  };

  return db;
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    ...overrides,
  };
}

function apiRequest(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(`https://aura.test${path}`, init);
}

/** Convenience: user payload for a tenant member. */
function tenantUser(tenantId: string | null, username = "user"): JwtPayload {
  return { username, tenantId };
}

/** Convenience: super admin with null tenant. */
const SUPER_ADMIN: JwtPayload = { username: "superadmin", role: "admin", tenantId: null };

// ── Seed helpers ────────────────────────────────────────────────────

function artistRow(seed: { id: string; tenantId: string; name: string }) {
  return {
    id: seed.id, tenant_id: seed.tenantId, name: seed.name, label: "Test Label",
    status: "active", image_url: "", genres: JSON.stringify(["electronic"]),
    social_links: JSON.stringify([]), total_releases: 0, signed_since: "2026-01-01",
    bio: "", created_at: NOW, updated_at: NOW,
  };
}

function taskRow(seed: { id: string; tenantId: string; title: string }) {
  return {
    id: seed.id, tenant_id: seed.tenantId, title: seed.title, description: "",
    status: "todo", priority: "medium", category: "admin", due_date: "",
    assignee: "", related_to_type: null, related_to_id: null, related_to_title: null,
    overdue: false, created_at: NOW, updated_at: NOW,
  };
}

function releaseRow(seed: { id: string; tenantId: string; title: string }) {
  return {
    id: seed.id, tenant_id: seed.tenantId, catalog_number: seed.id.replace("release-", "CAT"),
    title: seed.title, artist: "Test Artist", artist_id: "artist-test",
    status: "draft", type: "album", artwork_url: "", release_date: "2026-08-01",
    genres: JSON.stringify(["electronic"]), label: "Test Label", track_count: 1,
    digital_stores: JSON.stringify([]), created_at: NOW, updated_at: NOW,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  TESTS
// ══════════════════════════════════════════════════════════════════════

describe("Tenant isolation — artists", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb({
      auralabels_artists: [
        artistRow({ id: "artist-a1", tenantId: TENANT_A, name: "Alpha Artist" }),
        artistRow({ id: "artist-b1", tenantId: TENANT_B, name: "Bravo Artist" }),
      ],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.clearAllMocks());

  it("GET /api/artists — tenant A sees only tenant A artists", async () => {
    const req = new Request("https://aura.test/api/artists");
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as Record<string, unknown>).name).toBe("Alpha Artist");
  });

  it("GET /api/artists — tenant B sees only tenant B artists", async () => {
    const req = new Request("https://aura.test/api/artists");
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_B));
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as Record<string, unknown>).name).toBe("Bravo Artist");
  });

  it("GET /api/artists/:id — tenant A gets 404 for tenant B's artist", async () => {
    const req = new Request("https://aura.test/api/artists/artist-b1");
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
  });

  it("GET /api/artists/:id — tenant A sees their own artist", async () => {
    const req = new Request("https://aura.test/api/artists/artist-a1");
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.name).toBe("Alpha Artist");
  });

  it("POST /api/artists — assigns creating user's tenantId", async () => {
    const req = apiRequest("POST", "/api/artists", { name: "New Artist", label: "My Label" });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    const artist = data.artist as Record<string, unknown>;
    expect(artist.tenantId || artist.tenant_id).toBe(TENANT_A);
    expect(artist.name).toBe("New Artist");
    const rows = db._store.auralabels_artists.filter(
      (r) => r.tenant_id === TENANT_A && r.name === "New Artist",
    );
    expect(rows).toHaveLength(1);
  });

  it("POST /api/artists — ignores tenantId in request body (uses JWT tenant)", async () => {
    // Malicious user sends tenantId of another tenant in the body.
    // The handler must ignore it and use the JWT's tenantId instead.
    const req = apiRequest("POST", "/api/artists", { name: "Hijack Artist", tenantId: TENANT_B });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(201);
    const row = db._store.auralabels_artists.find((r) => r.name === "Hijack Artist");
    expect(row?.tenant_id).toBe(TENANT_A);
    expect(row?.tenant_id).not.toBe(TENANT_B);
  });

  it("PUT /api/artists/:id — tenant A cannot update tenant B's artist (404)", async () => {
    const req = apiRequest("PUT", "/api/artists/artist-b1", { name: "Hacked" });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_artists.find((r) => r.id === "artist-b1")?.name).toBe("Bravo Artist");
  });

  it("PUT /api/artists/:id — tenant A can update their own artist", async () => {
    const req = apiRequest("PUT", "/api/artists/artist-a1", { name: "Updated Alpha" });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.artist as Record<string, unknown>).name).toBe("Updated Alpha");
  });

  it("DELETE /api/artists/:id — tenant A cannot delete tenant B's artist (404)", async () => {
    const req = new Request("https://aura.test/api/artists/artist-b1", { method: "DELETE" });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_artists.find((r) => r.id === "artist-b1")).toBeTruthy();
  });

  it("DELETE /api/artists/:id — tenant A can delete their own artist", async () => {
    const req = new Request("https://aura.test/api/artists/artist-a1", { method: "DELETE" });
    const res = await artistsHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    expect(db._store.auralabels_artists.find((r) => r.id === "artist-a1")).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("Tenant isolation — tasks", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb({
      auralabels_tasks: [
        taskRow({ id: "task-a1", tenantId: TENANT_A, title: "Alpha Task" }),
        taskRow({ id: "task-b1", tenantId: TENANT_B, title: "Bravo Task" }),
      ],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.clearAllMocks());

  it("GET /api/tasks — tenant A sees only tenant A tasks", async () => {
    const req = new Request("https://aura.test/api/tasks");
    const res = await tasksHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as Record<string, unknown>).title).toBe("Alpha Task");
  });

  it("GET /api/tasks/:id — tenant A gets 404 for tenant B's task", async () => {
    const req = new Request("https://aura.test/api/tasks/task-b1");
    const res = await tasksHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
  });

  it("POST /api/tasks — assigns creating user's tenantId", async () => {
    const req = apiRequest("POST", "/api/tasks", { title: "New Task", status: "in_progress" });
    const res = await tasksHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.task as Record<string, unknown>).tenantId || (data.task as Record<string, unknown>).tenant_id).toBe(TENANT_A);
  });

  it("PUT /api/tasks/:id — tenant A cannot update tenant B's task (404)", async () => {
    const req = apiRequest("PUT", "/api/tasks/task-b1", { title: "Hacked" });
    const res = await tasksHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_tasks.find((r) => r.id === "task-b1")?.title).toBe("Bravo Task");
  });

  it("DELETE /api/tasks/:id — tenant A cannot delete tenant B's task (404)", async () => {
    const req = new Request("https://aura.test/api/tasks/task-b1", { method: "DELETE" });
    const res = await tasksHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_tasks.find((r) => r.id === "task-b1")).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("Tenant isolation — releases", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb({
      auralabels_releases: [
        releaseRow({ id: "release-a1", tenantId: TENANT_A, title: "Alpha Release" }),
        releaseRow({ id: "release-b1", tenantId: TENANT_B, title: "Bravo Release" }),
      ],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.clearAllMocks());

  it("GET /api/releases — tenant A sees only tenant A releases", async () => {
    const req = new Request("https://aura.test/api/releases");
    const res = await releasesHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(1);
    expect((data[0] as Record<string, unknown>).title).toBe("Alpha Release");
  });

  it("GET /api/releases/:id — tenant A gets 404 for tenant B's release", async () => {
    const req = new Request("https://aura.test/api/releases/release-b1");
    const res = await releasesHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
  });

  it("POST /api/releases — assigns creating user's tenantId", async () => {
    const req = apiRequest("POST", "/api/releases", { title: "New Release", artist: "Test", type: "single" });
    const res = await releasesHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.release as Record<string, unknown>).tenantId || (data.release as Record<string, unknown>).tenant_id).toBe(TENANT_A);
  });

  it("PUT /api/releases/:id — tenant A cannot update tenant B's release (404)", async () => {
    const req = apiRequest("PUT", "/api/releases/release-b1", { title: "Hacked" });
    const res = await releasesHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_releases.find((r) => r.id === "release-b1")?.title).toBe("Bravo Release");
  });

  it("DELETE /api/releases/:id — tenant A cannot delete tenant B's release (404)", async () => {
    const req = new Request("https://aura.test/api/releases/release-b1", { method: "DELETE" });
    const res = await releasesHandler(req, makeEnv(), CORS, tenantUser(TENANT_A));
    expect(res.status).toBe(404);
    expect(db._store.auralabels_releases.find((r) => r.id === "release-b1")).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("Tenant isolation — super admin (tenantId: null)", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb({
      auralabels_artists: [
        artistRow({ id: "artist-a1", tenantId: TENANT_A, name: "Alpha Artist" }),
        artistRow({ id: "artist-b1", tenantId: TENANT_B, name: "Bravo Artist" }),
      ],
      auralabels_tasks: [
        taskRow({ id: "task-a1", tenantId: TENANT_A, title: "Alpha Task" }),
        taskRow({ id: "task-b1", tenantId: TENANT_B, title: "Bravo Task" }),
      ],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.clearAllMocks());

  it("GET /api/artists — super admin sees ALL tenants", async () => {
    const req = new Request("https://aura.test/api/artists");
    const res = await artistsHandler(req, makeEnv(), CORS, SUPER_ADMIN);
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(2);
  });

  it("GET /api/tasks — super admin sees ALL tenants", async () => {
    const req = new Request("https://aura.test/api/tasks");
    const res = await tasksHandler(req, makeEnv(), CORS, SUPER_ADMIN);
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(2);
  });

  it("POST /api/artists — super admin writes to 'default' tenant", async () => {
    const req = apiRequest("POST", "/api/artists", { name: "Super Admin Artist", label: "Super Label" });
    const res = await artistsHandler(req, makeEnv(), CORS, SUPER_ADMIN);
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.artist as Record<string, unknown>).tenantId || (data.artist as Record<string, unknown>).tenant_id).toBe("default");
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("Tenant isolation — unauthenticated (user: null)", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb({
      auralabels_artists: [
        artistRow({ id: "artist-a1", tenantId: TENANT_A, name: "Alpha Artist" }),
        artistRow({ id: "artist-b1", tenantId: TENANT_B, name: "Bravo Artist" }),
      ],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.clearAllMocks());

  it("GET /api/artists — unauthenticated sees all rows (no filter)", async () => {
    const req = new Request("https://aura.test/api/artists");
    const res = await artistsHandler(req, makeEnv(), CORS, null);
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data).toHaveLength(2);
  });

  it("POST /api/artists — unauthenticated defaults to 'default' tenant", async () => {
    const req = apiRequest("POST", "/api/artists", { name: "Anon Artist", label: "Anon Label" });
    const res = await artistsHandler(req, makeEnv(), CORS, null);
    expect(res.status).toBe(201);
    expect(db._store.auralabels_artists.find((r) => r.name === "Anon Artist")?.tenant_id).toBe("default");
  });
});
