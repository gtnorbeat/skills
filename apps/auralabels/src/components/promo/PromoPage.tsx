import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, restoreCampaign, fetchReleases, fetchArtists } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { PromoCampaign, Release, Artist, CampaignStatus, Priority } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { PromoCard } from "./PromoCard";
import { PromoDetail } from "./PromoDetail";

const STATUS_FILTERS = [
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
];

const PRIORITY_FILTERS = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const todayIso = () => new Date().toISOString().split("T")[0];

interface NewCampaignForm {
  name: string;
  artistId: string;
  releaseId: string;
  status: CampaignStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  budget: number;
}

const NEW_CAMPAIGN_DEFAULT = (): NewCampaignForm => ({
  name: "",
  artistId: "",
  releaseId: "",
  status: "planning",
  priority: "medium",
  startDate: todayIso(),
  endDate: todayIso(),
  budget: 0,
});

export function PromoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>(NEW_CAMPAIGN_DEFAULT);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchCampaigns(), fetchReleases(), fetchArtists()])
      .then(([c, r, a]) => {
        if (mounted) {
          setCampaigns(c);
          setReleases(r);
          setArtists(a);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load campaigns");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newCampaign.name.trim() || !newCampaign.artistId) return;
    const artist = artists.find((a) => a.id === newCampaign.artistId);
    const release = newCampaign.releaseId
      ? releases.find((r) => r.id === newCampaign.releaseId)
      : null;
    try {
      const created = await createCampaign({
        name: newCampaign.name.trim(),
        artist: artist?.name ?? "Unknown",
        // PromoCampaign shape doesn't carry artistId — server stores
        // just `artist` (denormalised name). The artistId from the
        // picker above is only used client-side to filter the release
        // dropdown; it's not persisted on the campaign row.
        releaseId: release?.id ?? "",
        releaseTitle: release?.title ?? "",
        status: newCampaign.status,
        priority: newCampaign.priority,
        startDate: newCampaign.startDate,
        endDate: newCampaign.endDate,
        budget: newCampaign.budget,
      });
      setCampaigns((prev) => [created, ...prev]);
      setShowNewForm(false);
      setNewCampaign(NEW_CAMPAIGN_DEFAULT());
      toast.success("Campaign created");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      setError(message);
      toast.error(message);
    }
  }

  const handleUpdate = useCallback(async (id: string, data: Partial<PromoCampaign>) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
    try {
      await updateCampaign(id, data);
      toast.success("Campagna salvata");
    } catch {
      toast.error("Errore nel salvataggio della campagna");
      try {
        const fresh = await fetchCampaigns();
        setCampaigns(fresh);
      } catch { /* noop — optimistic update, refetch handles drift */ }
    }
  }, [toast]);

  /**
   * Card-row delete quick action. Confirms inline, calls API, removes
   * from local state, and closes the open detail panel if it's rooted
   * at the same id.
   */
  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel).
   *  Replaces the previous window.confirm dance (two clicks on every
   *  accidental click) with a single-click delete + a 5s confirmation
   *  snack carrying the Undo affordance. */
  const { delete: deleteCampaignRow } = useUndoableDelete<PromoCampaign>({
    apiDelete: deleteCampaign,
    apiRestore: restoreCampaign,
    items: campaigns,
    setItems: setCampaigns,
    labelFn: (c) => `Campaign "${c.name}"`,
  });

  async function handleCampaignCardDelete(campaign: PromoCampaign) {
    await deleteCampaignRow(campaign);
    if (id === campaign.id) navigate("/promo");
  }

  const filtered = campaigns.filter((c) => {
    const ms = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.artist.toLowerCase().includes(search.toLowerCase());
    const ss = statusFilter === "all" || c.status === statusFilter;
    const ps = priorityFilter === "all" || c.priority === priorityFilter;
    return ms && ss && ps;
  });

  // Releases for the selected artist — the modal's release <select>
  // filters by artist so picking the artist first narrows the options.
  const artistReleases = newCampaign.artistId
    ? releases.filter((r) => r.artistId === newCampaign.artistId)
    : releases;

  const selected = id ? campaigns.find((c) => c.id === id) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="Promo Campaigns" subtitle={`${campaigns.length} total • ${filtered.length} shown`} />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput value={search} onChange={setSearch} placeholder="Search campaigns..." />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Campaign</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6">
        <FilterBar label="Status" options={STATUS_FILTERS} selected={statusFilter} onChange={setStatusFilter} />
        <FilterBar label="Priority" options={PRIORITY_FILTERS} selected={priorityFilter} onChange={setPriorityFilter} />
      </div>

      {/* Error — offline-aware. Previous `window.location.reload()` retry
          was unnecessarily destructive — ErrorState's retry calls the
          fetch chain without a full page refresh. */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={() => {
            setLoading(true);
            Promise.all([fetchCampaigns(), fetchReleases(), fetchArtists()])
              .then(([c, r, a]) => { setCampaigns(c); setReleases(r); setArtists(a); setError(null); })
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
              .finally(() => setLoading(false));
          }}
        />
      )}

      {/* List */}
      {loading ? (
        <PageLoader message="" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">◉</span>
          <p className="text-sm font-medium text-zinc-400">No campaigns found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {campaigns.length === 0
              ? 'Add your first campaign with the "+ New Campaign" button'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <div key={c.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <PromoCard
                campaign={c}
                onClick={() => navigate(`/promo/${c.id}`)}
                onDelete={() => void handleCampaignCardDelete(c)}
              />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <PromoDetail
          campaign={selected}
          onClose={() => navigate("/promo")}
          onUpdate={handleUpdate}
        />
      )}

      {/* New Campaign modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Campaign</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >✕</button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label htmlFor="campaign-name" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Campaign name
                </label>
                <input
                  id="campaign-name"
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. BN1 Launch Campaign"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="campaign-artist" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Artist
                </label>
                <select
                  id="campaign-artist"
                  required
                  value={newCampaign.artistId}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, artistId: e.target.value, releaseId: "" }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">Select an artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="campaign-release" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Release <span className="text-zinc-600">(optional)</span>
                </label>
                <select
                  id="campaign-release"
                  value={newCampaign.releaseId}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, releaseId: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">— No release —</option>
                  {artistReleases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.catalogNumber} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="campaign-status" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
                  <select
                    id="campaign-status"
                    value={newCampaign.status}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, status: e.target.value as CampaignStatus }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="campaign-priority" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label>
                  <select
                    id="campaign-priority"
                    value={newCampaign.priority}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="campaign-start" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Start</label>
                  <input
                    id="campaign-start"
                    type="date"
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-end" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">End</label>
                  <input
                    id="campaign-end"
                    type="date"
                    value={newCampaign.endDate}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="campaign-budget" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Budget (€)
                </label>
                <input
                  id="campaign-budget"
                  type="number"
                  min={0}
                  value={newCampaign.budget}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, budget: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCampaign.name.trim() || !newCampaign.artistId}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
