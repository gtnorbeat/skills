import { http, HttpResponse, delay } from "msw";
import { signToken, verifyToken, type JwtPayload } from "@/auth";

/** Shared secret — must match what the client's signToken expects. */
const JWT_SECRET = "test-integration-secret";

/** In-memory "database" of users for the mock Worker. */
const USERS = new Map<string, { username: string; passwordHash: string; role: string; disabled: boolean }>();

/** Seed a test user so login can succeed. */
export function seedUser(username: string, password: string, role = "admin", disabled = false) {
  // Use a pre-computed bcrypt hash of the password for deterministic tests.
  // The real Worker uses bcrypt.compare() — here we just store a plaintext
  // comparison since we're mocking the database layer, not bcrypt itself.
  USERS.set(username, { username, passwordHash: password, role, disabled });
}

export function clearUsers() {
  USERS.clear();
}

/** Verify a Bearer token and return the payload, or null. */
async function auth(req: Request): Promise<JwtPayload | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  return verifyToken(token, JWT_SECRET);
}

/** Helper: extract a JSON body from a request. */
async function jsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export const handlers = [
  // ── POST /api/login ──────────────────────────────────────────────
  http.post("*/api/login", async ({ request }) => {
    await delay(10); // simulate network latency
    const body = await jsonBody<{ username?: string; password?: string }>(request);

    if (!body.username || !body.password) {
      return HttpResponse.json(
        { status: "error", message: "Username and password are required" },
        { status: 400 },
      );
    }

    const user = USERS.get(body.username);
    if (!user || user.passwordHash !== body.password) {
      return HttpResponse.json(
        { status: "error", message: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (user.disabled) {
      return HttpResponse.json(
        { status: "error", message: "Account disabled. Contact an admin." },
        { status: 403 },
      );
    }

    const token = await signToken(
      { username: user.username, role: user.role as "admin" | "user" },
      JWT_SECRET,
    );

    return HttpResponse.json({ status: "ok", token });
  }),

  // ── GET /api/verify ─────────────────────────────────────────────
  http.get("*/api/verify", async ({ request }) => {
    const user = await auth(request);
    if (!user) {
      return HttpResponse.json(
        { status: "error", message: "Invalid or expired token" },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      status: "ok",
      user: { username: user.username, role: user.role },
    });
  }),

  // ── GET /api/artists ────────────────────────────────────────────
  http.get("*/api/artists", async ({ request }) => {
    const user = await auth(request);
    if (!user) {
      return HttpResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );
    }
    const artists = [
      {
        id: "art-1", name: "GTN-O", label: "ORBEAT Records", status: "active",
        imageUrl: "", genres: ["Melodic Techno"], socialLinks: [],
        totalReleases: 1, signedSince: "2024-01-01", bio: "Test artist",
      },
      {
        id: "art-2", name: "Martiness", label: "ORBEAT Records", status: "active",
        imageUrl: "", genres: ["Progressive House"], socialLinks: [],
        totalReleases: 2, signedSince: "2024-03-01", bio: "Test artist 2",
      },
    ];
    return HttpResponse.json(artists);
  }),

  // ── GET /api/demos ──────────────────────────────────────────────
  http.get("*/api/demos", async ({ request }) => {
    const user = await auth(request);
    if (!user) {
      return HttpResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );
    }
    const demos = [
      {
        id: "demo-1", artistName: "Lunar Tide", email: "lunar@test.com",
        instagram: "@lunar", trackTitle: "Depth Charge", genre: "Melodic Techno",
        duration: "6:30", bpm: 126, key: "A min", receivedDate: "2025-01-01",
        status: "new", rating: null, labelFit: null, privateLink: "",
        audioUrl: "", notes: "", nextAction: null,
      },
      {
        id: "demo-2", artistName: "Velora", email: "velora@test.com",
        instagram: "@velora", trackTitle: "Fading Light", genre: "Progressive House",
        duration: "7:12", bpm: 122, key: "C maj", receivedDate: "2025-01-02",
        status: "listening", rating: 4, labelFit: "good", privateLink: "",
        audioUrl: "", notes: "Promising", nextAction: "Schedule call",
      },
    ];
    return HttpResponse.json(demos);
  }),

  // ── Catch-all for unhandled routes ──────────────────────────────
  http.all("*", () => {
    return HttpResponse.json({ error: "Not found" }, { status: 404 });
  }),
];
