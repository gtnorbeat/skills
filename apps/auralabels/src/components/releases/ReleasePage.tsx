import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Release } from "@/types";
import { fetchReleases, createRelease, deleteRelease, restoreRelease, fetchArtists } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { Artist } from "@/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDetail } from "./ReleaseDetail";

const STATUS_FILTERS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "Mastering", value: "mastering" },
  { label: "Artwork", value: "artwork_pending" },
  { label: "Draft", value: "draft" },
];

const PRIORITY_FILTERS = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

export function ReleasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [releases, setReleases] = useState<Release[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtistId, setNewArtistId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [releasesData, artistsData] = await Promise.all([
        fetchReleases(),
        fetchArtists(),
      ]);
      setReleases(releasesData);
      setArtists(artistsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newArtistId) return;
    try {
      const artist = artists.find((a) => a.id === newArtistId);
      const created = await createRelease({
        title: newTitle.trim(),
        artist: artist?.name ?? "",
        artistId: newArtistId,
      });
      setReleases((prev) => [...prev, created]);
      setNewTitle("");
      setNewArtistId("");
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create release");
    }
  }

  const filtered = releases.filter((release) => {
    const matchesSearch =
      release.title.toLowerCase().includes(search.toLowerCase()) ||
      release.artist.toLowerCase().includes(search.toLowerCase()) ||
      release.catalogNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || release.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || release.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const selectedRelease = id
    ? releases.find((r) => r.id === id) ?? null
    : null;

  function handleReleaseUpdated(updated: Release) {
    setReleases((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleReleaseDeleted(id: string) {
    setReleases((prev) => prev.filter((r) => r.id !== id));
  }

  /**
   * Card-row delete — confirms inline, calls API, removes from state,
   * and closes the open detail panel if it's rooted at this id.
   */
  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel). */
  const { delete: deleteReleaseRow } = useUndoableDelete<Release>({
    apiDelete: deleteRelease,
    apiRestore: restoreRelease,
    items: releases,
    setItems: setReleases,
    labelFn: (r) => `Release "${r.title}" (${r.catalogNumber})`,
  });

  async function handleReleaseCardDelete(release: Release) {
    await deleteReleaseRow(release);
    if (id === release.id) navigate("/releases");
  }

  const handleCloseDetail = () => {
    navigate("/releases");
  };

  if (loading) {
    return <PageLoader message="" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Releases"
          subtitle={`${releases.length} total • ${filtered.length} shown`}
        />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search releases..."
            />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Release</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6">
        <FilterBar
          label="Status"
          options={STATUS_FILTERS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterBar
          label="Priority"
          options={PRIORITY_FILTERS}
          selected={priorityFilter}
          onChange={setPriorityFilter}
        />
      </div>

      {/* Error — offline-aware */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={loadData}
        />
      )}

      {/* List */}
      {!error && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">▣</span>
          <p className="text-sm font-medium text-zinc-400">No releases found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {releases.length === 0
              ? 'Add your first release with the "+ New Release" button'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((release, i) => (
            <div key={release.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <ReleaseCard
                release={release}
                onClick={() => navigate(`/releases/${release.id}`)}
                onDelete={() => void handleReleaseCardDelete(release)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedRelease && (
        <ReleaseDetail
          release={selectedRelease}
          onClose={handleCloseDetail}
          onUpdated={handleReleaseUpdated}
          onDeleted={handleReleaseDeleted}
        />
      )}

      {/* New Release modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Release</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRelease} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. BN1"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Artist
                </label>
                <select
                  value={newArtistId}
                  onChange={(e) => setNewArtistId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">Select an artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
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
                  disabled={!newTitle.trim() || !newArtistId}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
