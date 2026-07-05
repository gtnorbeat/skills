import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Artist } from "@/types";
import { fetchArtists, createArtist, deleteArtist, restoreArtist } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { ArtistCard } from "./ArtistCard";
import { ArtistDetail } from "./ArtistDetail";

const STATUS_FILTERS = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Prospect", value: "prospect" },
];

export function ArtistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadArtists();
  }, []);

  async function loadArtists() {
    try {
      setLoading(true);
      const data = await fetchArtists();
      setArtists(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artists");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateArtist(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await createArtist({ name: newName.trim() });
      setArtists((prev) => [...prev, created]);
      setNewName("");
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create artist");
    }
  }

  const filtered = artists.filter((artist) => {
    const matchesSearch =
      artist.name.toLowerCase().includes(search.toLowerCase()) ||
      artist.genres.some((g) => g.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      statusFilter === "all" || artist.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedArtist = id ? artists.find((a) => a.id === id) ?? null : null;

  function handleArtistUpdated(updated: Artist) {
    setArtists((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handleArtistDeleted(id: string) {
    setArtists((prev) => prev.filter((a) => a.id !== id));
  }

  /**
   * Card-row delete quick action. Confirms, calls the API, then both
   * removes the row from local state AND closes any open detail panel
   * rooted at this id (otherwise the detail panel would still render a
   * ghost card after the row disappears). navigate("/artists") rather
   * than a local setSelectedId toggle because the detail route lives in
   * the URL bar and the URL param drives the panel mount — patching the
   * state alone wouldn't close it.
   */
  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel). */
  const { delete: deleteArtistRow } = useUndoableDelete<Artist>({
    apiDelete: deleteArtist,
    apiRestore: restoreArtist,
    items: artists,
    setItems: setArtists,
    labelFn: (a) => `Artist "${a.name}"`,
  });

  async function handleArtistCardDelete(artist: Artist) {
    await deleteArtistRow(artist);
    if (id === artist.id) navigate("/artists");
  }

  const handleCloseDetail = () => {
    navigate("/artists");
  };

  if (loading) {
    return <PageLoader message="" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Artists"
          subtitle={`${artists.length} total • ${filtered.length} shown`}
        />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search artists..."
            />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Artist</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        label="Status"
        options={STATUS_FILTERS}
        selected={statusFilter}
        onChange={setStatusFilter}
      />

      {/* Error — offline-aware: surface a clearer message when the
          network is down so the user knows it's a connectivity issue
          rather than a server-side failure. */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={loadArtists}
        />
      )}

      {/* Grid */}
      {!error && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">◈</span>
          <p className="text-sm font-medium text-zinc-400">No artists found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {artists.length === 0
              ? 'Add your first artist with the "+ New Artist" button'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((artist, i) => (
            <div key={artist.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <ArtistCard
                artist={artist}
                onClick={() => navigate(`/artists/${artist.id}`)}
                onDelete={() => void handleArtistCardDelete(artist)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedArtist && (
        <ArtistDetail
          artist={selectedArtist}
          onClose={handleCloseDetail}
          onUpdated={handleArtistUpdated}
          onDeleted={handleArtistDeleted}
        />
      )}

      {/* New Artist modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Artist</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateArtist}>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Artist Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. GTN-O"
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                autoFocus
              />
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Artist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
