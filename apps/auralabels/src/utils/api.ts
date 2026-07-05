import type { DemoSubmission, Artist, Contract, Release, Task, PromoCampaign, AIAction, ArtistActivity, RevenueSummary, AppNotification, UserSummary, JwtClaims, BetaApplication, BetaApplicationStatus } from "@/types";

const API_BASE = "/api";

/** Default per-request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 15_000;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Wraps a `fetch()` call with an AbortController timeout. If the request
 * does not settle within `timeoutMs`, the controller aborts and the
 * caller receives an `AbortError`. The caller can distinguish
 * AbortError (timeout / user cancellation) from TypeError (network
 * down / DNS failure) and from HTTP error responses (4xx / 5xx).
 *
 * Timeout defaults to {@link DEFAULT_TIMEOUT_MS} (15 s) — individual
 * callers can pass a shorter or longer cap for expensive operations
 * (e.g. AI generation) or fast lookups (e.g. checkAuth).
 *
 * MOBILE_FIRST Phase 8 — timeout + offline-aware error path so a
 * single hung request can't strand the entire page. Uses
 * `navigator.onLine` in the catch block to augment the error
 * message with a user-facing "appears offline" hint.
 *
 * Exported so individual pages and hooks can adopt it incrementally
 * without rewriting every fetch call in this module at once.
 */
async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // Re-throw as a plain Error so callers get a uniform interface.
      throw new Error("Request timed out — the server may be under heavy load", { cause: err });
    }
    // TypeError from fetch means the network is unreachable.
    // Augment the message with an explicit offline hint.
    if (err instanceof TypeError && typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You appear to be offline — check your connection and try again", { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public exports for timeout-aware callers ──────────────────────

export { fetchWithTimeout, DEFAULT_TIMEOUT_MS as FETCH_TIMEOUT_MS };

// Auth

export async function login(username: string, password: string): Promise<string> {
  const res = await fetchWithTimeout(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data.token;
}

/** Self-service tenant registration — creates a new label + admin user in one step. */
export interface RegisterPayload {
  username: string;
  password: string;
  email: string;
  labelName: string;
  /** hCaptcha response token from the widget. */
  "h-captcha-response"?: string;
}

export interface RegisterResult {
  status: string;
  token: string;
  user: {
    username: string;
    role: string;
    tenantId: string;
    labelName: string;
  };
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const res = await fetchWithTimeout(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Registration failed");
  return data as RegisterResult;
}

export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/verify`, {
      headers: { ...getAuthHeaders() },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Demos

export async function fetchDemos(): Promise<DemoSubmission[]> {
  const res = await fetchWithTimeout(`${API_BASE}/demos`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch demos: ${res.statusText}`);
  return res.json();
}

// Manual demo entry — for demos that arrive via email / referral and
// the webhook hasn't caught up. The server's INSERT will guarantee the
// schema column set so the caller can send a partial DemoSubmission.
export async function createDemo(data: Partial<DemoSubmission>): Promise<DemoSubmission> {
  const res = await fetchWithTimeout(`${API_BASE}/demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create demo: ${res.statusText}`);
  const body = await res.json();
  // Matches the GET shape so callers can setState(...) immediately.
  return (body?.demo ?? body) as DemoSubmission;
}

export async function deleteDemo(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/demos/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete demo: ${res.statusText}`);
}

/**
 * Restore a demo that was just deleted, within the toast undo window.
 * The client holds a deep snapshot of the row after the DELETE fires
 * and POSTs it back so the server re-inserts using the original `id`
 * (the FK refs in `activities.artistName` etc. stay stable across
 * delete+undo). Returns the freshly-read row in the same shape the
 * GET endpoint returns, so the caller can setState(...) immediately.
 */
export async function restoreDemo(id: string, snapshot: DemoSubmission): Promise<DemoSubmission> {
  const res = await fetchWithTimeout(`${API_BASE}/demos/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) throw new Error(`Failed to restore demo: ${res.statusText}`);
  const data = await res.json();
  return (data?.demo ?? data) as DemoSubmission;
}

export async function updateDemo(
  id: string,
  updates: Partial<Pick<DemoSubmission, "status" | "rating" | "notes" | "labelFit" | "nextAction">>
): Promise<DemoSubmission> {
  const res = await fetchWithTimeout(`${API_BASE}/demos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update demo: ${res.statusText}`);
  const data = await res.json();
  return data.demo;
}

// Artists

export async function fetchArtists(): Promise<Artist[]> {
  const res = await fetchWithTimeout(`${API_BASE}/artists`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch artists: ${res.statusText}`);
  return res.json();
}

export async function fetchArtist(id: string): Promise<Artist> {
  const res = await fetchWithTimeout(`${API_BASE}/artists/${id}`, {
    headers: { ...getAuthHeaders() },
  });
  return handleResponse<{ artist: Artist }>(res).then((d) => d.artist);
}

export async function createArtist(data: Partial<Artist>): Promise<Artist> {
  const res = await fetchWithTimeout(`${API_BASE}/artists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ artist: Artist }>(res).then((d) => d.artist);
}

export async function updateArtist(id: string, data: Partial<Artist>): Promise<Artist> {
  const res = await fetchWithTimeout(`${API_BASE}/artists/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ artist: Artist }>(res).then((d) => d.artist);
}

export async function deleteArtist(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/artists/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete artist: ${res.statusText}`);
}

export async function restoreArtist(id: string, snapshot: Artist): Promise<Artist> {
  const res = await fetchWithTimeout(`${API_BASE}/artists/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<{ artist: Artist }>(res).then((d) => d.artist);
}

// Releases

export async function fetchReleases(): Promise<Release[]> {
  const res = await fetchWithTimeout(`${API_BASE}/releases`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch releases: ${res.statusText}`);
  return res.json();
}

export async function fetchRelease(id: string): Promise<Release> {
  const res = await fetchWithTimeout(`${API_BASE}/releases/${id}`, {
    headers: { ...getAuthHeaders() },
  });
  return handleResponse<{ release: Release }>(res).then((d) => d.release);
}

export async function createRelease(data: Partial<Release>): Promise<Release> {
  const res = await fetchWithTimeout(`${API_BASE}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ release: Release }>(res).then((d) => d.release);
}

export async function updateRelease(id: string, data: Partial<Release>): Promise<Release> {
  const res = await fetchWithTimeout(`${API_BASE}/releases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ release: Release }>(res).then((d) => d.release);
}

export async function deleteRelease(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/releases/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete release: ${res.statusText}`);
}

export async function restoreRelease(id: string, snapshot: Release): Promise<Release> {
  const res = await fetchWithTimeout(`${API_BASE}/releases/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<{ release: Release }>(res).then((d) => d.release);
}

// Contracts

export async function fetchContracts(): Promise<Contract[]> {
  const res = await fetchWithTimeout(`${API_BASE}/contracts`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch contracts: ${res.statusText}`);
  return res.json();
}

export async function createContract(data: Partial<Contract>): Promise<Contract> {
  const res = await fetchWithTimeout(`${API_BASE}/contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ contract: Contract }>(res).then((d) => d.contract);
}

export async function updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
  const res = await fetchWithTimeout(`${API_BASE}/contracts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ contract: Contract }>(res).then((d) => d.contract);
}

export async function deleteContract(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/contracts/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete contract: ${res.statusText}`);
}

export async function restoreContract(id: string, snapshot: Contract): Promise<Contract> {
  const res = await fetchWithTimeout(`${API_BASE}/contracts/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<{ contract: Contract }>(res).then((d) => d.contract);
}

// Tasks

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetchWithTimeout(`${API_BASE}/tasks`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.statusText}`);
  return res.json();
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  const res = await fetchWithTimeout(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ task: Task }>(res).then((d) => d.task);
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const res = await fetchWithTimeout(`${API_BASE}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ task: Task }>(res).then((d) => d.task);
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete task: ${res.statusText}`);
}

export async function restoreTask(id: string, snapshot: Task): Promise<Task> {
  const res = await fetchWithTimeout(`${API_BASE}/tasks/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<{ task: Task }>(res).then((d) => d.task);
}

// Campaigns

export async function fetchCampaigns(): Promise<PromoCampaign[]> {
  const res = await fetchWithTimeout(`${API_BASE}/campaigns`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.statusText}`);
  return res.json();
}

export async function createCampaign(data: Partial<PromoCampaign>): Promise<PromoCampaign> {
  const res = await fetchWithTimeout(`${API_BASE}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ campaign: PromoCampaign }>(res).then((d) => d.campaign);
}

export async function updateCampaign(id: string, data: Partial<PromoCampaign>): Promise<PromoCampaign> {
  const res = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<{ campaign: PromoCampaign }>(res).then((d) => d.campaign);
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete campaign: ${res.statusText}`);
}

export async function restoreCampaign(id: string, snapshot: PromoCampaign): Promise<PromoCampaign> {
  const res = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<{ campaign: PromoCampaign }>(res).then((d) => d.campaign);
}

// Revenue

export async function fetchRevenue(): Promise<RevenueSummary> {
  const res = await fetchWithTimeout(`${API_BASE}/revenue`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch revenue: ${res.statusText}`);
  return res.json();
}

// AI Actions

export async function fetchAIActions(): Promise<AIAction[]> {
  const res = await fetchWithTimeout(`${API_BASE}/ai-actions`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch AI actions: ${res.statusText}`);
  return res.json();
}

// Notifications

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await fetchWithTimeout(`${API_BASE}/notifications`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

// AI Generate

export interface AIGenerateRequest {
  actionType: string;
  artist: {
    name?: string;
    label?: string;
    genres?: string[];
    totalReleases?: number;
    bio?: string;
    signedSince?: string;
  } | null;
  release: {
    title?: string;
    catalogNumber?: string;
    genres?: string[];
    releaseDate?: string;
    tracks?: { bpm?: number }[];
    launchChecklist?: { id?: string; title: string; completed: boolean; required: boolean }[];
    readinessPercentage?: number;
  } | null;
  demo?: {
    artistName?: string;
    trackTitle?: string;
    genre?: string;
    rating?: number | null;
    notes?: string;
    status?: string;
  } | null;
  contract?: {
    artist?: string;
    type?: string;
    status?: string;
    revenueShare?: number;
    value?: number;
    rights?: string;
    signedDate?: string | null;
    expiryDate?: string | null;
    gdprStatus?: string;
    ipiStatus?: string;
    fileUrl?: string | null;
    nextAction?: string | null;
    notes?: string;
  } | null;
  tone: string;
  context?: string;
  /**
   * Target channel for the output. When set, the server weaves platform-specific
   * format/hashtag/char-limit guidance into the AI provider system prompts
   * and applies a soft charCap on the template fallback. Vocabulary matches the
   * platforms list on CampaignIntelligencePage's campaigns. Empty / omitted =
   * generic channel-neutral copy.
   */
  platform?: string;
}

export async function generateAI(data: AIGenerateRequest): Promise<{ content: string; provider: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "AI generation failed" }));
    throw new Error(err.message || `AI generation failed: ${res.statusText}`);
  }
  const result = await res.json();
  return { content: result.content, provider: result.provider };
}// Files (R2 upload)

export async function uploadFile(
  file: File,
  folder: string,
  entityId?: string,
): Promise<{ key: string; url: string; size: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  if (entityId) formData.append("entityId", entityId);

  const res = await fetchWithTimeout(`${API_BASE}/files/upload`, {
    method: "POST",
    // Let the browser set Content-Type with the correct multipart boundary
    headers: { ...getAuthHeaders() } as Record<string, string> & { "Content-Type"?: string },
    body: formData,
  });
  return handleResponse(res);
}

// Activities
export async function fetchActivities(): Promise<ArtistActivity[]> {
  const res = await fetchWithTimeout(`${API_BASE}/activities`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch activities: ${res.statusText}`);
  return res.json();
}

/**
 * Record a row in the activity feed. Fire-and-forget — transient
 * failures are swallowed inside the helper so one network blip never
 * unwinds the UI flow that triggered the activity (e.g. the Approve &
 * Invite shortcut confirms approval + operator creation BEFORE this
 * call lands; if /api/activities is momentarily unreachable we still
 * want the invite to feel committed, and the dashboard's next refetch
 * will reconcile against the server's authoritative activities table).
 *
 * `timestamp` is server-stamped (the server's POST handler defaults
 * `body.timestamp` to `new Date().toISOString()` if absent), so the
 * `now` value lives in exactly one place — the database row at insert
 * time. Supports the audit-loop surface TeamAccessPanel's invite
 * path already uses; the BetaApplicationsPanel's Approve & Invite
 * shortcut now mirrors the same pattern.
 */
export async function logActivity(
  data: Pick<ArtistActivity, "artistId" | "artistName" | "action" | "type">,
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to log activity: ${res.statusText}`);
  } catch (err) {
    // Audit-only — don't unwind the caller. Surface in the console so a
    // transient outage is at least loggable from a devtools session.
    console.warn("Failed to log activity:", err);
  }
}

/* ── Data Management (clear / export / import) ─────────────────────── */

// Export interface matching the server's shape
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExportPayload extends Record<string, unknown[]> {}

/**
 * POST /api/admin/clear-data
 * Deletes all business data. Requires a confirmation string.
 */
export async function clearAllData(confirmText: string): Promise<{ deleted: Record<string, number> }> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/clear-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ confirm: confirmText }),
  });
  const data = await handleResponse<{ status: string; deleted: Record<string, number> }>(res);
  return { deleted: data.deleted };
}

/**
 * GET /api/admin/export
 * Exports all label data as a structured JSON payload.
 */
export async function exportAllData(): Promise<ExportPayload> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/export`, {
    headers: { ...getAuthHeaders() },
  });
  const data = await handleResponse<{ status: string; meta: unknown; data: ExportPayload }>(res);
  return data.data;
}

/**
 * POST /api/admin/import
 * Imports label data from a previously exported JSON payload.
 */
export async function importAllData(data: ExportPayload): Promise<{ imported: Record<string, number> }> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ data }),
  });
  const result = await handleResponse<{ status: string; imported: Record<string, number> }>(res);
  return { imported: result.imported };
}

/* ── Admin user management (Settings → Team Access) ───────────────── */

// Decode the JWT claims straight off localStorage so the Settings page
// can decide whether to render the Team Access panel WITHOUT an extra
// round-trip to `/api/verify`. The token is exactly what the server
// signed — same secret, same base64url payload — so the `role` claim
// is the truth source for "is this caller an admin right now?".
//
// We're not verifying the signature here because (a) any subsequent
// admin API call will return 401/403 if the token is invalid, which
// quickly catches tampering, and (b) re-running HMAC-SHA256 in the
// browser just to read a UI flag is wasted work. The login flow has
// already proven the token at issuance time and `checkAuth()` re-runs
// the server-side check on every app boot.
export function getCurrentClaims(): JwtClaims | null {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64: swap url-safe chars, then pad to a multiple of 4.
    const std = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
}

export async function fetchUsers(): Promise<UserSummary[]> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/users`, {
    headers: { ...getAuthHeaders() },
  });
  const data = await handleResponse<{ status: string; users: UserSummary[] }>(res);
  return data.users;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: "admin" | "user";
  tenantId?: string | null;
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ status: string; user: UserSummary }>(res);
  return data.user;
}

export interface UpdateUserPayload {
  /** Plaintext. Server bcrypts at rest. */
  password?: string;
  role?: "admin" | "user";
  /** Empty string clears tenantId; `null` keeps current; undefined leaves it alone. */
  tenantId?: string | null;
  disabled?: boolean;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ status: string; user: UserSummary }>(res);
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/users/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to delete user: ${res.statusText}`);
  }
}

/* ── Admin beta-application review (Settings → Beta Applications) ── */

// Closed-beta recruitment inbound via POST /api/beta-applications — no public UI surface post-LandingPage removal (commit f47a3a8). The server
// stores applications with `status='pending'` on POST; the admin
// flips status (approved/rejected/spam) here and the server re-stamps
// `reviewedBy` / `reviewedAt` on every PATCH regardless of the new
// status value (so a "reset to pending" review still records the
// admin's last action timestamp in the audit trail).

export async function fetchBetaApplications(): Promise<BetaApplication[]> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/beta-applications`, {
    headers: { ...getAuthHeaders() },
  });
  const data = await handleResponse<{ status: string; applications: BetaApplication[] }>(res);
  return data.applications;
}

export async function updateBetaApplication(
  id: string,
  payload: { status: BetaApplicationStatus },
): Promise<BetaApplication> {
  const res = await fetchWithTimeout(`${API_BASE}/admin/beta-applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ status: string; application: BetaApplication }>(res);
  return data.application;
}
