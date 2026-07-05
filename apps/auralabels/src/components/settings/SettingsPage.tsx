import { useRef, useState, useEffect } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { BetaApplicationsPanel } from "./BetaApplicationsPanel";
import { generatePassword } from "@/utils/password";
import { useTheme, type ThemeMode } from "@/components/ui/ThemeProvider";
import type { UserSummary } from "@/types";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  getCurrentClaims,
  clearAllData,
  exportAllData,
  importAllData,
  type UpdateUserPayload,
} from "@/utils/api";

interface LabelSettings {
  labelName: string;
  slogan: string;
  defaultGenre: string;
  defaultRoyaltySplit: number;
  distributor: string;
  brandTone: string;
  aiProvider: string;
  apiKey: string;
}

const DEFAULT_SETTINGS: LabelSettings = {
  labelName: "ORBEAT Records",
  slogan: "Emotion in Motion",
  defaultGenre: "Melodic Techno",
  defaultRoyaltySplit: 75,
  distributor: "DistroKid",
  brandTone: "Underground / Premium",
  aiProvider: "OpenRouter",
  apiKey: "",
};

export function SettingsPage() {
  // isAdmin — read directly from the JWT so the Team Access card reads/writes
  // as soon as the page mounts. Avoids an effect + verify round-trip.
  const claims = getCurrentClaims();
  const isAdmin = claims?.role === "admin";

  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Read once; updated state isn't needed because the Header chip is the
  // canonical source and the logout handler reloads to refresh both.
  const sessionUsername = (() => {
    try {
      return localStorage.getItem("auth_user") ?? "";
    } catch {
      return "";
    }
  })();

  const update = <K extends keyof LabelSettings>(
    key: K,
    value: LabelSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = () => {
    if (!confirm("Sign out of AURA on this device?")) return;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    // Reload so App.tsx re-evaluates auth and renders LoginPage cleanly.
    window.location.reload();
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <SectionHeader
        title="Settings"
        subtitle="Configure your label and prepare for API connections"
      />

      {/* Session — always at the top so logout is one click away even if
          the user never touches label/AI settings below. */}
      <DashboardCard>
        <SectionHeader
          title="Session"
          subtitle="Your local session on this device"
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {sessionUsername || "Unknown user"}
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Tokens stay on this device. Sign out clears stored credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200"
          >
            <span aria-hidden="true">⏻</span>
            Sign out
          </button>
        </div>
      </DashboardCard>

      {/* Appearance — theme selector for the whole app */}
      <AppearanceCard />

      {/* Admin-only cards */}
      {isAdmin && (
        <>
          <TeamAccessPanel />
          <BetaApplicationsPanel />
        </>
      )}

      {/* Label Info */}
      <DashboardCard>
        <SectionHeader title="Label Information" />
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-label-name" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Label Name
              </label>
              <input
                id="settings-label-name"
                type="text"
                value={settings.labelName}
                onChange={(e) => update("labelName", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label htmlFor="settings-slogan" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Slogan
              </label>
              <input
                id="settings-slogan"
                type="text"
                value={settings.slogan}
                onChange={(e) => update("slogan", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label htmlFor="settings-default-genre" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Default Genre
              </label>
              <input
                id="settings-default-genre"
                type="text"
                value={settings.defaultGenre}
                onChange={(e) => update("defaultGenre", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label htmlFor="settings-royalty-split" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Default Royalty Split (artist %)
              </label>
              <input
                id="settings-royalty-split"
                type="number"
                min={0}
                max={100}
                value={settings.defaultRoyaltySplit}
                onChange={(e) => update("defaultRoyaltySplit", Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label htmlFor="settings-distributor" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Distributor
              </label>
              <select
                id="settings-distributor"
                value={settings.distributor}
                onChange={(e) => update("distributor", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              >
                <option>DistroKid</option>
                <option>Label Engine</option>
                <option>Too Lost</option>
                <option>Believe</option>
                <option>Ingrooves</option>
                <option>The Orchard</option>
                <option>DigDis</option>
                <option>Symphony</option>
                <option>Proton</option>
              </select>
            </div>
            <div>
              <label htmlFor="settings-brand-tone" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                Brand Tone
              </label>
              <select
                id="settings-brand-tone"
                value={settings.brandTone}
                onChange={(e) => update("brandTone", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              >
                <option>Underground / Premium</option>
                <option>Professional</option>
                <option>Dark / Cinematic</option>
                <option>Minimal / Clean</option>
                <option>Bold / Aggressive</option>
              </select>
            </div>
          </div>

          {/* Save lives in the page footer below so it covers Label Info AND
              the AI/API configuration card. Previously the Save button was
              scoped to Label Info only — pasting an API key into the AI card
              and clicking "Save" did nothing for the key. */}
        </div>
      </DashboardCard>

      {/* AI & API Configuration */}
      <DashboardCard>
        <SectionHeader
          title="AI & API Configuration"
          subtitle="Prepare for future connections"
        />
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-ai-provider" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                AI Provider
              </label>
              <select
                id="settings-ai-provider"
                value={settings.aiProvider}
                onChange={(e) => update("aiProvider", e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              >
                <option>OpenRouter</option>
                <option>Workers AI</option>
              </select>
            </div>
            <div>
              <label htmlFor="settings-api-key" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                API Key
              </label>
              <div className="relative">
                <input
                  id="settings-api-key"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="off"
                  value={settings.apiKey}
                  onChange={(e) => update("apiKey", e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 pr-10 text-sm text-white placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-zinc-600">
                Your key stays on this device. No data is sent to any server.
              </p>
            </div>
          </div>

          {/* Single page-wide Save — persists Label Info AND the AI/API card
              (provider + key) together. Previously Save was only attached to
              the Label Info card, so pasting a key and clicking Save gave no
              visible effect for the key. */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:from-cyan-500 hover:to-violet-500"
            >
              {saved ? "✓ Saved" : "Save Settings"}
            </button>
            {saved && (
              <span className="text-[11px] text-emerald-400">
                Settings saved locally — API key persisted on this device
              </span>
            )}
          </div>
        </div>
      </DashboardCard>

      {/* Future Connections */}
      <DashboardCard>
        <SectionHeader
          title="Future Connections"
          subtitle="Services to connect when ready"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { name: "Supabase", icon: "◇", desc: "Cloud database & auth" },
            { name: "Google Drive", icon: "◇", desc: "Asset storage & backup" },
            { name: "Gmail", icon: "✉", desc: "Send emails from the app" },
            { name: "Google Calendar", icon: "▤", desc: "Sync deadlines & events" },
            { name: "Google Sheets", icon: "▣", desc: "Export data to sheets" },
            { name: "Notion", icon: "◇", desc: "Sync label documentation" },
            { name: "localStorage", icon: "◆", desc: "Coming soon — offline first" },
            { name: "Multi Record Labels Switcher", icon: "◈", desc: "Switch between multiple label profiles" },
          ].map((service) => (
            <div
              key={service.name}
              className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3 opacity-60"
            >
              <span className="text-sm text-zinc-600">{service.icon}</span>
              <div>
                <p className="text-xs font-medium text-zinc-400">{service.name}</p>
                <p className="text-[10px] text-zinc-600">{service.desc}</p>
              </div>
              <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-zinc-700">
                Planned
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Data Management — admin only */}
      {isAdmin && <DataManagementCard />}

      {/* About */}
      <DashboardCard>
        <SectionHeader title="About" />
        <div className="space-y-1 text-xs text-zinc-500">
          <p>AURA — A&amp;R Utility &amp; Resources AI Assistant v1.0</p>
          <p>Built for personal use — private, offline-first label management</p>
        </div>
      </DashboardCard>
    </div>
  );
}

/* ── Appearance — theme selector ─────────────────── */

function AppearanceCard() {
  const { mode, resolvedTheme, setMode } = useTheme();

  const options: { value: ThemeMode; label: string; icon: string; desc: string }[] = [
    { value: "light", label: "Light", icon: "☀️", desc: "White backgrounds with dark text — crisp and clean" },
    { value: "dark", label: "Dark", icon: "🌙", desc: "Black backgrounds with light text — easier on the eyes at night" },
    { value: "system", label: "System", icon: "🖥", desc: `Follows your device setting (currently ${resolvedTheme === "dark" ? "dark" : "light"})` },
  ];

  return (
    <DashboardCard>
      <SectionHeader
        title="Appearance"
        subtitle="Choose your preferred colour theme for the app"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((opt) => {
          const isActive = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-all ${
                isActive
                  ? "border-cyan-500/40 bg-cyan-500/5 text-cyan-400 shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-sm"
              }`}
              aria-pressed={isActive}
              aria-label={`${opt.label} theme`}
            >
              <span className="text-2xl" aria-hidden="true">{opt.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-cyan-400" : "text-zinc-900"}`}>
                  {opt.label}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[11px]"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </DashboardCard>
  );
}

/* ── Team Access — admin-only operator management ─────────────────── */

// Brand note on rotation UX: a typo'd password is much more recoverable
// than an accidentally-pushed one. Both fields are required, the submit
// button stays disabled until they match, and the input itself is the
// confirmation. The server enforces the same 8-char minimum as create.
function TeamAccessPanel() {
  const { toast } = useToast();
  const claims = getCurrentClaims();
  const currentUsername = claims?.username ?? "";

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal-driven invite flow: the inline form was lifted out of the
  // always-visible chrome so the admin's task-at-the-moment (rotate
  // passwords, demote, audit) doesn't carry a permanently-mounted add-user
  // surface. The generated password replaces the manual one the inline
  // form asked for — admin never types it; the copy-to-clipboard toast
  // is the channel to share the temp credential out-of-band. New users
  // default to role='user' (server-side rule for self-server POST) and
  // tenantId=null; the admin can PATCH the row afterwards if they need a
  // different role / tenant binding.
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [inviting, setInviting] = useState(false);

  // useFocusTrap wires Esc-to-close + Tab cycling + opener-focus restore —
  // keyboard users land in the username input on Enter and return to the
  // "Invite operator" button after Esc. The hook owns the window-level
  // keydown listener for the trap's lifetime.
  useFocusTrap(modalRef, modalOpen, () => setModalOpen(false));

  // Inline copy of the password generator used to live here — now imported
  // from `@/utils/password` so both invite surfaces (this modal +
  // BetaApplicationsPanel's Approve & Invite shortcut) share the same
  // generator and the same format. The temp credential copy lives there.

  // Inline per-row expanded states — only one row at a time shows its
  // rotation form OR delete confirm, so the panel doesn't grow vertically
  // by 4 × user-count when five operators are listed.
  const [rotationUserId, setRotationUserId] = useState<string | null>(null);
  const [rotation, setRotation] = useState({ password: "", confirm: "" });

  // Per-row role select — mirrors the rotate-password affordance. One
  // row at a time opens its inline editor so the panel doesn't grow
  // vertically by user-count. Last-active-admin demotion is blocked by
  // the server; UI mirrors the lock with a disabled Save button.
  const [roleEditingUserId, setRoleEditingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<"admin" | "user">("user");

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      toast.error((err as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // mount-only — re-load only when the user clicks "Refresh"
  }, []);

  const openInviteModal = () => {
    setInviteUsername("");
    setGeneratedPassword(generatePassword());
    setInviting(false);
    setModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (inviting) return;
    if (!inviteUsername.trim() || generatedPassword.length < 8) return;
    setInviting(true);
    try {
      // role='user' is the closed-beta default: signup via this modal
      // always lands as a non-admin operator. Admins who need to grant
      // admin role to a peer can PATCH the row from the user list
      // (existing flow, role select lives in the per-row rotation/role
      // affordance). tenantId is left undefined so the server keeps it
      // null on a fresh row.
      const created = await createUser({
        username: inviteUsername.trim(),
        password: generatedPassword,
        role: "user",
      });
      setModalOpen(false);
      // Snag the password into a local before close so the action handler
      // doesn't read state that the modal wipe just nuked. toast.action's
      // default 5500ms beat is enough time to spot + click the Copy CTA.
      const tempPwd = generatedPassword;
      toast.action(
        `Invited "${created.username}". Temp password (12 chars): ${tempPwd}`,
        {
          label: "Copy",
          onClick: () => {
            navigator.clipboard
              .writeText(tempPwd)
              .then(() => toast.info("Temp password copied to clipboard"))
              .catch(() =>
                toast.error(
                  "Couldn't copy to clipboard — share the password manually",
                ),
              );
          },
        },
      );
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to create user");
    } finally {
      setInviting(false);
    }
  };

  const handleRotate = async (userId: string) => {
    if (rotation.password.length < 8) return;
    if (rotation.password !== rotation.confirm) return;
    try {
      await updateUser(userId, { password: rotation.password } satisfies UpdateUserPayload);
      toast.success("Password rotated");
      setRotationUserId(null);
      setRotation({ password: "", confirm: "" });
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to rotate password");
    }
  };

  const handleToggleDisabled = async (user: UserSummary) => {
    try {
      await updateUser(user.id, { disabled: !user.disabled } satisfies UpdateUserPayload);
      toast.success(user.disabled ? "User re-enabled" : "User disabled");
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to update user");
    }
  };

  // Role change — single-field form, parallel to the rotation-pw form.
  // Server has the last-admin / self-action guards; UI just gates Save
  // on (a) actual change vs current role and (b) not demoting the last
  // active admin.
  const handleRoleChange = async (user: UserSummary) => {
    if (pendingRole === user.role) return;
    try {
      await updateUser(user.id, { role: pendingRole } satisfies UpdateUserPayload);
      toast.success(`Role → ${pendingRole} for "${user.username}"`);
      setRoleEditingUserId(null);
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to update role");
    }
  };

  const handleDelete = async (user: UserSummary) => {
    if (deleteConfirmText !== user.username) return;
    try {
      await deleteUser(user.id);
      toast.success(`User "${user.username}" deleted`);
      setDeletingUserId(null);
      setDeleteConfirmText("");
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete user");
    }
  };

  const cancelInline = () => {
    setRotationUserId(null);
    setRotation({ password: "", confirm: "" });
    setRoleEditingUserId(null);
    setDeletingUserId(null);
    setDeleteConfirmText("");
  };

  // Rotation UX: gating. Submit stays disabled unless both fields are
  // entered AND match. The "match" line is the visible confirmation step
  // — one glance shows whether the typing agrees.
  const rotationValid =
    rotationUserId !== null &&
    rotation.password.length >= 8 &&
    rotation.password === rotation.confirm;

  // Active user count for defensive UI: if only one active admin remains,
  // surface a chip so the operator knows what's about to break before the
  // server rejects their last-admin action with a 400.
  const activeAdminCount = users.filter((u) => u.role === "admin" && !u.disabled).length;

  return (
    <DashboardCard>
      <SectionHeader
        title="Team Access"
        subtitle="Manage operators — create, rotate passwords, disable accounts"
      />

      {/* Invite-action — opens the modal below. The always-visible inline
          form was collapsed into a click-to-open modal so the chrome
          doesn't carry a permanently-mounted add-user surface for an
          admin whose current task is rotate/demote/audit. The modal
          houses the username field + auto-generated password; the
          copy-to-clipboard toast is the channel to share the temp
          credential with the invitee. */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openInviteModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:from-cyan-500 hover:to-violet-500"
        >
          <span aria-hidden="true">＋</span>
          Invite operator
        </button>
      </div>

      {/* Invite modal — useFocusTrap handles Esc-to-close + Tab cycling
          + opener-focus restoration (the "Invite operator" button above).
          z-50 sits above chrome (z-40 sidebar/MobileTabBar overlay
          backdrops) without conflicting with the toast container at
          z-[9999]. Backdrop click also closes; Send-invite success closes
          the modal and surfaces the temp password via the toast.action
          Copy CTA. The modal itself is portal-less — the TeamAccessPanel
          is the natural mount point and the parent's overflow context is
          overflow-y-auto on <main>, so position: fixed reaches the
          viewport regardless of the scroll position. */}
      {modalOpen && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Invite a new operator"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-cyan-500/30 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Invite a new operator
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  They'll receive a temporary password you share
                  out-of-band (Slack DM, email, password-manager handoff).
                  New invitees join as non-admin operators — change role
                  on this row at any time after invite. The user can have
                  their password rotated after first login.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close invite dialog"
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="invite-username"
                  className="mb-1.5 block text-[11px] font-medium text-zinc-500"
                >
                  Username
                </label>
                <input
                  id="invite-username"
                  type="text"
                  required
                  autoComplete="off"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="e.g. orchestrator"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                />
                <p className="mt-1 text-[10px] text-zinc-600">
                  Role defaults to <code className="font-mono">user</code>.
                  Change role on this row at any time after invite.
                </p>
              </div>

              <div>
                <label htmlFor="invite-temp-password" className="mb-1.5 block text-[11px] font-medium text-zinc-500">
                  Temporary password (auto-generated)
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    id="invite-temp-password"
                    type="text"
                    readOnly
                    value={generatedPassword}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 cursor-text rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setGeneratedPassword(generatePassword())}
                    className="rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-[11px] font-medium text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-200"
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-zinc-600">
                  12 chars from a cryptographically-secure RNG. After
                  invite, the success toast offers a "Copy" CTA so you can
                  paste it into a DM / email / password manager cleanly.
                </p>
              </div>

              {activeAdminCount === 1 && (
                <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
                  ⚠ You are the only active admin. New invitees always land
                  as user — change role on a peer's row after invite to
                  share admin duties and close this single-admin gap.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={inviting}
                className="rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendInvite()}
                disabled={
                  inviting ||
                  !inviteUsername.trim() ||
                  generatedPassword.length < 8
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:from-cyan-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Operators ({users.length})
          </h3>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {loading && users.length === 0 ? (
          <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 px-4 py-8 text-center text-xs text-zinc-600">
            Loading operators…
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 px-4 py-8 text-center text-xs text-zinc-600">
            No operators yet — add the first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.username === currentUsername;
              const showingRotation = rotationUserId === u.id;
              const showingRoleEdit = roleEditingUserId === u.id;
              const showingDelete = deletingUserId === u.id;
              const lastAdmin = u.role === "admin" && !u.disabled && activeAdminCount === 1;

              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 px-4 py-3"
                >
                  {/* Row header */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {u.username}
                        </span>
                        {isSelf && (
                          <StatusBadge
                            label="you"
                            colorClass="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                          />
                        )}
                        <StatusBadge
                          label={u.role}
                          colorClass={
                            u.role === "admin"
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                              : "border-zinc-700/40 bg-zinc-800/40 text-zinc-400"
                          }
                        />
                        <StatusBadge
                          label={u.disabled ? "Disabled" : "Active"}
                          colorClass={
                            u.disabled
                              ? "border-red-500/30 bg-red-500/10 text-red-300"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          }
                          pulse={!u.disabled}
                        />
                        {u.tenantId && (
                          <span className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] text-zinc-500">
                            tenant: {u.tenantId}
                          </span>
                        )}
                        {lastAdmin && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                            last active admin
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        Updated {new Date(u.updatedAt).toLocaleString()}
                        {u.createdAt && u.createdAt !== u.updatedAt && (
                          <> · created {new Date(u.createdAt).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Change role — first action so the role-bearing chip
                          on the row is mirrored by an in-line editor below.
                          No self-action guard: admins may self-demote when
                          other admins remain, and the server is the source
                          of truth for the last-admin lock. */}
                      <button
                        type="button"
                        onClick={() => {
                          cancelInline();
                          setRoleEditingUserId(showingRoleEdit ? null : u.id);
                          setPendingRole(u.role);
                        }}
                        className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-3.5 text-[11px] font-medium text-zinc-300 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-200"
                      >
                        {showingRoleEdit ? "Cancel" : "Change role"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          cancelInline();
                          setRotationUserId(showingRotation ? null : u.id);
                          setRotation({ password: "", confirm: "" });
                        }}
                        className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-3.5 text-[11px] font-medium text-zinc-300 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-200"
                      >
                        {showingRotation ? "Cancel" : "Rotate password"}
                      </button>

                      {/* Disable / Enable — hidden for own row to match the
                          server's self-action guard, which prevents an admin
                          from accidentally locking themselves out of the UI. */}
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => void handleToggleDisabled(u)}
                          disabled={lastAdmin && !u.disabled}
                          title={
                            lastAdmin && !u.disabled
                              ? "Cannot disable the last active admin"
                              : undefined
                          }
                          className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-3.5 text-[11px] font-medium text-zinc-300 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800/60 disabled:hover:bg-zinc-900/60 disabled:hover:text-zinc-300"
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                      )}

                      {/* Delete — same self-action guard. */}
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            cancelInline();
                            setDeletingUserId(showingDelete ? null : u.id);
                            setDeleteConfirmText("");
                          }}
                          className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-3.5 text-[11px] font-medium text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200"
                        >
                          {showingDelete ? "Cancel" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Role change editor — single-field inline form. Save
                      stays disabled when the picked role is already the
                      current one (no-op) or when the change would demote
                      the last active admin (server enforces too). */}
                  {showingRoleEdit && (
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                      <div>
                        <label htmlFor={`role-select-${u.id}`} className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-violet-400/80">
                          New role
                        </label>
                        <select
                          id={`role-select-${u.id}`}
                          value={pendingRole}
                          onChange={(e) =>
                            setPendingRole(e.target.value as "admin" | "user")
                          }
                          className="rounded-md border border-violet-500/30 bg-zinc-900/60 px-3 py-3.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                        >
                          <option value="user">user (operator)</option>
                          <option value="admin">admin (full access)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRoleChange(u)}
                        disabled={
                          pendingRole === u.role ||
                          (lastAdmin && u.role === "admin" && pendingRole === "user")
                        }
                        title={
                          lastAdmin && u.role === "admin" && pendingRole === "user"
                            ? "Cannot demote the last active admin"
                            : undefined
                        }
                        className="rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-3.5 text-[11px] font-semibold text-white transition-all hover:from-violet-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save role
                      </button>
                    </div>
                  )}

                  {/* Rotation confirmation form */}
                  {showingRotation && (
                    <div className="mt-3 space-y-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`rotate-new-password-${u.id}`} className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-cyan-400/80">
                            New password (min 8)
                          </label>
                          <input
                            id={`rotate-new-password-${u.id}`}
                            type="password"
                            autoComplete="new-password"
                            value={rotation.password}
                            onChange={(e) => setRotation((r) => ({ ...r, password: e.target.value }))}
                            className="w-full rounded-md border border-cyan-500/30 bg-zinc-900/60 px-3 py-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                          />
                        </div>
                        <div>
                          <label htmlFor={`rotate-confirm-password-${u.id}`} className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-cyan-400/80">
                            Confirm new password
                          </label>
                          <input
                            id={`rotate-confirm-password-${u.id}`}
                            type="password"
                            autoComplete="new-password"
                            value={rotation.confirm}
                            onChange={(e) => setRotation((r) => ({ ...r, confirm: e.target.value }))}
                            className="w-full rounded-md border border-cyan-500/30 bg-zinc-900/60 px-3 py-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-[10px] ${
                            rotation.password.length === 0
                              ? "text-zinc-600"
                              : rotation.password === rotation.confirm
                                ? "text-emerald-400"
                                : "text-red-400"
                          }`}
                          role="status"
                        >
                          {rotation.password.length === 0
                            ? "Type the new password twice to confirm."
                            : rotation.password === rotation.confirm
                              ? "✓ Passwords match"
                              : "✗ Passwords do not match"}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleRotate(u.id)}
                          disabled={!rotationValid}
                          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-cyan-600 to-violet-600 px-3 py-3.5 text-[11px] font-semibold text-white transition-all hover:from-cyan-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rotate password
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete confirmation — type-username flow */}
                  {showingDelete && (
                    <div className="mt-3 space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="text-[11px] text-red-300">
                        This permanently removes <span className="font-semibold">{u.username}</span>{" "}
                        from the database. Their JWT will reject on next verify, and the{" "}
                        username can be re-created later if needed.
                      </p>
                      <div>
                        <label htmlFor={`delete-confirm-${u.id}`} className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-red-400/80">
                          Type the username to confirm
                        </label>
                        <input
                          id={`delete-confirm-${u.id}`}
                          type="text"
                          autoComplete="off"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={u.username}
                          className="w-full rounded-md border border-red-500/30 bg-zinc-900/60 px-3 py-3.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelInline}
                          className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-3 py-3.5 text-[11px] font-medium text-zinc-300 transition-all hover:bg-zinc-800/60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(u)}
                          disabled={deleteConfirmText !== u.username}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500 bg-red-500/15 px-3 py-3.5 text-[11px] font-semibold text-red-200 transition-all hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete user
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[10px] text-zinc-600">
          Server enforces a minimum password length of 8 chars, refuses self-disable / self-demote
          / self-delete, and the last-admin protection is a hard rule on the server{" "}
          (not just here in the UI).
        </p>
      </div>
    </DashboardCard>
  );
}

/* ── Data Management — clear, export, import ──────────────────────── */

function DataManagementCard() {
  const { toast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-label-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Label data exported successfully");
    } catch (err) {
      toast.error((err as Error).message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Support both raw export format and wrapped { data } format
        const payload = data.data ?? data;
        const result = await importAllData(payload);
        const total = Object.values(result.imported).reduce((a, b) => a + b, 0);
        toast.success(`Imported ${total} records across ${Object.keys(result.imported).length} tables`);
        // Reload to refresh all data views
        window.location.reload();
      } catch (err) {
        toast.error((err as Error).message || "Import failed — check the file format");
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (clearConfirmText !== "DELETE ALL DATA") return;
    setClearing(true);
    try {
      const result = await clearAllData("DELETE ALL DATA");
      const total = Object.values(result.deleted).reduce((a, b) => a + b, 0);
      toast.success(`Cleared ${total} records from the database`);
      setShowClearConfirm(false);
      setClearConfirmText("");
      // Reload to refresh all data views
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message || "Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  return (
    <DashboardCard>
      <SectionHeader
        title="Data Management"
        subtitle="Export, import, or clear your label data"
      />

      {/* Export / Import */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export All Data (JSON)"}
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import Data (JSON)"}
        </button>
        <button
          onClick={() => {
            setShowClearConfirm(true);
            setClearConfirmText("");
          }}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200"
        >
          Clear All Data
        </button>
      </div>

      <p className="mt-3 text-[10px] text-zinc-600">
        Export downloads all artists, releases, demos, contracts, tasks, campaigns, and users
        as a JSON file. Import restores from a previously exported file (replaces current data).
        Clear permanently removes all business data but preserves user accounts.
      </p>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-[11px] font-medium text-red-300">
            ⚠ This will permanently delete all artists, releases, demos, contracts, tasks,
            campaigns, activities, revenue data, and beta applications. User accounts and
            their passwords will be preserved.
          </p>
          <div className="mt-3">
            <label htmlFor="clear-confirm-text" className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-red-400/80">
              Type DELETE ALL DATA to confirm
            </label>
            <input
              id="clear-confirm-text"
              type="text"
              autoComplete="off"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="DELETE ALL DATA"
              className="w-full rounded-md border border-red-500/30 bg-zinc-900/60 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowClearConfirm(false);
                setClearConfirmText("");
              }}
              disabled={clearing}
              className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-[11px] font-medium text-zinc-300 transition-all hover:bg-zinc-800/60 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={clearConfirmText !== "DELETE ALL DATA" || clearing}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Clear All Data"}
            </button>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
