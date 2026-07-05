export type ReleaseStatus =
  | "draft"
  | "mastering"
  | "artwork_pending"
  | "scheduled"
  | "released"
  | "archived";

export type ContractStatus =
  | "draft"
  | "sent"
  | "signed"
  | "expired"
  | "terminated";

export type DemoStatus =
  | "new"
  | "listening"
  | "interested"
  | "rejected"
  | "accepted";

export type CampaignStatus =
  | "planning"
  | "active"
  | "completed"
  | "paused";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

export type Priority = "low" | "medium" | "high" | "critical";

export type ArtistStatus = "active" | "inactive" | "signed" | "prospect";

export interface Artist {
  id: string;
  name: string;
  label: string;
  status: ArtistStatus;
  imageUrl: string;
  genres: string[];
  socialLinks: SocialLink[];
  missingInfo?: MissingInfoItem[];
  upcomingReleases?: string[];
  totalReleases: number;
  signedSince: string;
  bio: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface MissingInfoItem {
  field: string;
  description: string;
}

export interface Release {
  id: string;
  catalogNumber: string;
  title: string;
  artist: string;
  artistId: string;
  status: ReleaseStatus;
  priority: Priority;
  releaseDate: string;
  tracks: Track[];
  artworkUrl: string;
  genres: string[];
  launchChecklist: ChecklistItem[];
  readinessPercentage: number;
  promoAssetsReady: boolean;
  distributorSubmitted: boolean;
  needsAttention: boolean;
}

export interface Track {
  id: string;
  title: string;
  duration: string;
  isMastered: boolean;
  bpm: number;
  key: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
}

export interface Contract {
  id: string;
  artist: string;
  artistId: string;
  type: "exclusive" | "non_exclusive" | "distribution" | "licensing";
  status: ContractStatus;
  priority: Priority;
  signedDate: string | null;
  expiryDate: string | null;
  revenueShare: number;
  value: number;
  rights: string;
  gdprStatus: "compliant" | "pending" | "not_applicable";
  ipiStatus: "registered" | "pending" | "not_submitted";
  missingData?: MissingInfoItem[];
  fileUrl: string | null;
  nextAction: string | null;
  notes: string;
}

export interface DemoSubmission {
  id: string;
  artistName: string;
  email: string;
  instagram: string;
  trackTitle: string;
  genre: string;
  duration: string;
  bpm: number;
  key: string;
  receivedDate: string;
  status: DemoStatus;
  rating: number | null;
  labelFit: "perfect" | "good" | "moderate" | "poor" | null;
  privateLink: string;
  audioUrl: string;
  notes: string;
  nextAction: string | null;
}

export type PromoChecklistStatus = "not_started" | "in_progress" | "done" | "n_a";

export interface CampaignChecklistItem {
  id: string;
  title: string;
  status: PromoChecklistStatus;
  required: boolean;
}

export interface PromoCampaign {
  id: string;
  name: string;
  releaseId: string;
  releaseTitle: string;
  artist: string;
  status: CampaignStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  platforms: string[];
  budget: number;
  impressions: number;
  engagements: number;
  promoPoolStatus: PromoChecklistStatus;
  djFeedbackStatus: PromoChecklistStatus;
  instagramContentStatus: PromoChecklistStatus;
  youtubeTeaserStatus: PromoChecklistStatus;
  beatportFeaturePitchStatus: PromoChecklistStatus;
  spotifyPitchStatus: PromoChecklistStatus;
  emailBlastStatus: PromoChecklistStatus;
  campaignChecklist: CampaignChecklistItem[];
  readinessPercentage: number;
  missingContent: string[];
  nextAction: string;
}

export type TaskCategory = "contract" | "artwork" | "mastering" | "promo" | "admin" | "social" | "distributor" | "content";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  category: TaskCategory;
  dueDate: string;
  assignee: string;
  relatedTo: {
    type: "release" | "artist" | "campaign" | "contract";
    id: string;
    title: string;
  } | null;
  overdue: boolean;
}

export interface AIAction {
  id: string;
  action: string;
  description: string;
  category: "copy" | "strategy" | "analysis" | "content";
  priority: Priority;
  createdAt: string;
  used: boolean;
}

export interface ContentTemplate {
  id: string;
  name: string;
  category: "social" | "press" | "promo" | "email";
  platform: string;
  content: string;
  lastUsed: string | null;
}

export interface RevenueSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayouts: number;
  revenueByArtist: { artist: string; amount: number }[];
  revenueByRelease: { release: string; amount: number }[];
  currency: string;
}

export interface ArtistActivity {
  artistId: string;
  artistName: string;
  action: string;
  timestamp: string;
  type: "release" | "social" | "contract" | "demo" | "note";
}

export interface AppNotification {
  id: string;
  type: "task_due" | "task_overdue" | "release_attention" | "contract_expiring" | "demo_review" | "artist_missing_info";
  title: string;
  description: string;
  link: string;
  createdAt: string;
  read: boolean;
}

export interface DashboardSummary {
  upcomingReleases: Release[];
  pendingContracts: Contract[];
  demosAwaitingReview: DemoSubmission[];
  activeCampaigns: PromoCampaign[];
  importantDeadlines: Task[];
  artistActivity: ArtistActivity[];
  revenue: RevenueSummary;
  aiRecommendations: AIAction[];
  todaysPriorities: Task[];
  overdueTasks: Task[];
  releasesNeedingAttention: Release[];
  missingArtistInformation: Artist[];
  launchReadiness: number;
  totalArtists: number;
  totalReleases: number;
  activeContracts: number;
  demosThisWeek: number;
}

/* ── Auth / users ────────────────────────────────────────────────── */

// Safe-projection shape returned by /api/admin/users. Matches the
// server's mapUserSafe() — passwordHash is never included. `disabled`
// lands as a boolean here (server normalises before send).
export interface UserSummary {
  id: string;
  username: string;
  role: "admin" | "user";
  tenantId: string | null;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// What sits inside the JWT payload. The Settings page reads this off
// localStorage (after atob-decoding the middle segment) so it can
// decide whether to render the Team Access panel. The backend signs
// these exact claims on login.
export interface JwtClaims {
  username: string;
  role?: "admin" | "user";
  tenantId?: string | null;
  iat?: number;
  exp?: number;
}

/* ── Beta applications (recruitment via POST /api/beta-applications) ────────── */

// Mirror of server/db.ts → mapBetaApplication(). Every field is
// normalised at the server boundary so the client can treat empty
// strings / nulls as the canonical "absent" shape without further
// coalescing. `role` is the free-string cohort the applicant submitted
// via the POST /api/beta-applications endpoint (one of BETA_APP_ALLOWED_ROLES + "Not
// specified"); the admin panel renders the literal value as a chip
// label — no enumeration, because the server is the source of truth
// and adding a cohort is a server-side change.
export type BetaApplicationStatus = "pending" | "approved" | "rejected" | "spam";

export interface BetaApplication {
  id: string;
  name: string;
  email: string;
  label: string;
  role: string;
  notes: string;
  status: BetaApplicationStatus;
  /** Username of the admin who PATCH'd the row last. `null` until the
   *  first review action lands. Re-stamps on every PATCH (the server
   *  doesn't track "original reviewer" — last action is the audit). */
  reviewedBy: string | null;
  /** ISO timestamp of the most recent PATCH. `null` until reviewed. */
  reviewedAt: string | null;
  /** ISO timestamp captured by the public POST handler on insert. */
  createdAt: string;
  /** ISO timestamp re-stamped on every PATCH. */
  updatedAt: string;
}
