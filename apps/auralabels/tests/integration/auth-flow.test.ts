/**
 * Auth flow integration tests.
 *
 * These tests exercise the actual fetch wrappers from api.ts against
 * a mocked Worker API (MSW). The goal is to verify that the client-side
 * auth token propagation works end-to-end:
 *
 *   1. login() → receives JWT, stores it in localStorage
 *   2. checkAuth() → sends Bearer token, server verifies it
 *   3. fetchArtists() / fetchDemos() → include Authorization header,
 *      receive data, handle 401 correctly when unauthenticated
 *
 * The MSW server runs in Node (not jsdom) because it imports auth.ts
 * which uses jose (Web Crypto). The jsdom cross-realm Uint8Array issue
 * from unit tests also applies here — running in Node avoids it.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { server } from "../mocks/server";
import { seedUser, clearUsers } from "../mocks/handlers";
import {
  login,
  checkAuth,
  fetchArtists,
  fetchDemos,
  fetchReleases,
} from "@/utils/api";

// ── MSW lifecycle ──────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  // resetHandlers restores the initial set registered via setupServer.
  server.resetHandlers();
  clearUsers();
  localStorage.clear();
});

// ── Auth flow ──────────────────────────────────────────────────────

describe("Auth flow (login → token → API calls)", () => {
  const TEST_USER = "gaetano";
  const TEST_PASS = "secret123";

  beforeEach(() => {
    seedUser(TEST_USER, TEST_PASS);
  });

  it("login() returns a JWT token for valid credentials", async () => {
    const token = await login(TEST_USER, TEST_PASS);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });

  it("login() throws for invalid credentials", async () => {
    await expect(login(TEST_USER, "wrong-password"))
      .rejects.toThrow("Invalid credentials");
  });

  it("login() throws when username is missing", async () => {
    await expect(login("", TEST_PASS))
      .rejects.toThrow();
  });

  it("checkAuth() returns true when a valid token is in localStorage", async () => {
    const token = await login(TEST_USER, TEST_PASS);
    localStorage.setItem("auth_token", token);

    const valid = await checkAuth();
    expect(valid).toBe(true);
  });

  it("checkAuth() returns false when localStorage has an invalid token", async () => {
    localStorage.setItem("auth_token", "not-a-real-jwt");

    const valid = await checkAuth();
    expect(valid).toBe(false);
  });

  it("checkAuth() returns false when localStorage has no token", async () => {
    const valid = await checkAuth();
    expect(valid).toBe(false);
  });
});

// ── Authenticated API calls ───────────────────────────────────────

describe("Authenticated API calls", () => {
  const USER = "admin";
  const PASS = "admin123";

  beforeEach(() => {
    seedUser(USER, PASS);
  });

  async function loginAndStore() {
    const token = await login(USER, PASS);
    localStorage.setItem("auth_token", token);
    return token;
  }

  it("fetchArtists() returns artists when authenticated", async () => {
    await loginAndStore();
    const artists = await fetchArtists();
    expect(artists).toHaveLength(2);
    expect(artists[0].name).toBe("GTN-O");
    expect(artists[1].name).toBe("Martiness");
  });

  it("fetchArtists() throws when not authenticated", async () => {
    // No token in localStorage — api.ts sends no Authorization header.
    await expect(fetchArtists()).rejects.toThrow();
  });

  it("fetchDemos() returns demos when authenticated", async () => {
    await loginAndStore();
    const demos = await fetchDemos();
    expect(demos).toHaveLength(2);
    expect(demos[0].artistName).toBe("Lunar Tide");
  });

  it("fetchDemos() throws when not authenticated", async () => {
    await expect(fetchDemos()).rejects.toThrow();
  });

  it("fetchReleases() throws when not authenticated", async () => {
    // Releases endpoint isn't mocked — MSW will return 404.
    // We just verify the client sends the request and gets an error back.
    await expect(fetchReleases()).rejects.toThrow();
  });

  it("multiple authenticated calls reuse the same token", async () => {
    await loginAndStore();

    const artists = await fetchArtists();
    const demos = await fetchDemos();

    expect(artists).toHaveLength(2);
    expect(demos).toHaveLength(2);
  });
});

// ── Token propagation — verify the client sends the right headers ──

describe("Token propagation", () => {
  const USER = "tester";
  const PASS = "test123";

  beforeEach(() => {
    seedUser(USER, PASS);
  });

  it("getAuthHeaders includes the Bearer token after login", async () => {
    const token = await login(USER, PASS);
    localStorage.setItem("auth_token", token);

    // checkAuth() calls GET /api/verify with the token.
    // If the handler receives it, verifyToken succeeds → 200.
    const valid = await checkAuth();
    expect(valid).toBe(true);
  });

  it("getAuthHeaders sends no header when localStorage has no token", async () => {
    localStorage.removeItem("auth_token");

    const valid = await checkAuth();
    expect(valid).toBe(false);
  });
});
