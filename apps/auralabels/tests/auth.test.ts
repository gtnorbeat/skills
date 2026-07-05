import { describe, it, expect } from "vitest";
import { signToken, verifyToken, authenticateRequest, isPublicPath, type JwtPayload } from "@/auth";

const TEST_SECRET = "test-secret-do-not-use-in-production";

describe("signToken", () => {
  it("returns a non-empty string", async () => {
    const token = await signToken({ username: "admin" }, TEST_SECRET);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("produces a JWT with three dot-separated segments", async () => {
    const token = await signToken({ username: "admin" }, TEST_SECRET);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("carries the role claim when provided", async () => {
    const token = await signToken(
      { username: "gaetano", role: "admin" },
      TEST_SECRET,
    );
    const payload = await verifyToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.username).toBe("gaetano");
    expect(payload!.role).toBe("admin");
  });

  it("carries the tenantId claim when provided", async () => {
    const token = await signToken(
      { username: "tenant-user", tenantId: "orb-001" },
      TEST_SECRET,
    );
    const payload = await verifyToken(token, TEST_SECRET);
    expect(payload!.tenantId).toBe("orb-001");
  });
});

describe("verifyToken", () => {
  it("returns null for a completely invalid string", async () => {
    const result = await verifyToken("not-a-jwt", TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyToken("", TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null when the secret does not match", async () => {
    const token = await signToken({ username: "admin" }, TEST_SECRET);
    const result = await verifyToken(token, "wrong-secret");
    expect(result).toBeNull();
  });

  it("returns the payload for a valid token", async () => {
    const token = await signToken({ username: "admin" }, TEST_SECRET);
    const result = await verifyToken(token, TEST_SECRET);
    expect(result).not.toBeNull();
    expect(result!.username).toBe("admin");
  });

  it("round-trips a payload with all optional fields", async () => {
    const payload: JwtPayload = {
      username: "full",
      role: "user",
      tenantId: "t-1",
    };
    const token = await signToken(payload, TEST_SECRET);
    const decoded = await verifyToken(token, TEST_SECRET);
    expect(decoded).toMatchObject({
      username: "full",
      role: "user",
      tenantId: "t-1",
    });
  });
});

describe("authenticateRequest", () => {
  it("returns null when there is no Authorization header", async () => {
    const req = new Request("https://example.com/api/demos");
    const result = await authenticateRequest(req, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null for a non-Bearer Authorization header", async () => {
    const req = new Request("https://example.com/api/demos", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    const result = await authenticateRequest(req, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null for an empty Bearer token", async () => {
    const req = new Request("https://example.com/api/demos", {
      headers: { Authorization: "Bearer " },
    });
    const result = await authenticateRequest(req, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns the payload for a valid Bearer token", async () => {
    const token = await signToken({ username: "admin" }, TEST_SECRET);
    const req = new Request("https://example.com/api/demos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await authenticateRequest(req, TEST_SECRET);
    expect(result).not.toBeNull();
    expect(result!.username).toBe("admin");
  });
});

describe("isPublicPath", () => {
  it("returns true for /api/health", () => {
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("returns true for /api/login", () => {
    expect(isPublicPath("/api/login")).toBe(true);
  });

  it("returns true for /api/_health/live", () => {
    expect(isPublicPath("/api/_health/live")).toBe(true);
  });

  it("returns true for /api/beta-applications", () => {
    expect(isPublicPath("/api/beta-applications")).toBe(true);
  });

  it("returns true for webhook paths", () => {
    expect(isPublicPath("/api/webhook/abc-123")).toBe(true);
  });

  it("returns false for /api/demos (authenticated route)", () => {
    expect(isPublicPath("/api/demos")).toBe(false);
  });

  it("returns false for /api/artists", () => {
    expect(isPublicPath("/api/artists")).toBe(false);
  });

  it("returns false for the dashboard root", () => {
    expect(isPublicPath("/")).toBe(false);
  });
});
