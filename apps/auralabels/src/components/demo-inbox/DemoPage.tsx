import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchDemos, createDemo, updateDemo, deleteDemo, restoreDemo } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { DemoSubmission, DemoStatus } from "@/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { DemoCard } from "./DemoCard";
import { DemoDetail } from "./DemoDetail";
import { useToast } from "@/components/ui/Toast";

const STATUS_FILTERS = [
  { label: "New", value: "new" },
  { label: "Listening", value: "listening" },
  { label: "Interested", value: "interested" },
  { label: "Rejected", value: "rejected" },
  { label: "Accepted", value: "accepted" },
];

const FIT_FILTERS = [
  { label: "Perfect", value: "perfect" },
  { label: "Good", value: "good" },
  { label: "Moderate", value: "moderate" },
  { label: "Poor", value: "poor" },
];

// Default state for the New Demo modal. Status defaults to "new" so the
// demo surfaces in the awaiting-review filter immediately. bpm/key are
// numbers/strings with safe zero/empty defaults to match the schema.
const NEW_DEMO_DEFAULT: Pick<DemoSubmission, "artistName" | "trackTitle" | "genre" | "instagram" | "privateLink" | "bpm" | "key" | "duration" | "email"> = {
  artistName: "",
  trackTitle: "",
  genre: "",
  instagram: "",
  privateLink: "",
  bpm: 0,
  key: "",
  duration: "",
  email: "",
};

export function DemoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fitFilter, setFitFilter] = useState("all");
  // Default to [] — previously this kept mockDemos as the fallback state.
  // The toast + empty-state branch now handle a 0-row grid cleanly.
  const [demos, setDemos] = useState<DemoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDemo, setNewDemo] = useState(NEW_DEMO_DEFAULT);

  useEffect(() => {
    let mounted = true;
    fetchDemos()
      .then((data) => {
        if (mounted) {
          setDemos(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load demos");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreateDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!newDemo.artistName.trim() || !newDemo.trackTitle.trim()) return;
    try {
      const created = await createDemo(newDemo);
      setDemos((prev) => [created, ...prev]);
      setShowNewForm(false);
      setNewDemo(NEW_DEMO_DEFAULT);
      toast.success(`Demo from ${created.artistName} added`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create demo";
      setError(message);
      toast.error(message);
    }
  }

  const filtered = demos.filter((demo) => {
    const matchesSearch =
      demo.artistName.toLowerCase().includes(search.toLowerCase()) ||
      demo.trackTitle.toLowerCase().includes(search.toLowerCase()) ||
      demo.genre.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || demo.status === statusFilter;
    const matchesFit =
      fitFilter === "all" || (demo.labelFit ?? "") === fitFilter;
    return matchesSearch && matchesStatus && matchesFit;
  });

  const selectedDemo = id
    ? demos.find((d) => d.id === id) ?? null
    : null;

  function handleDemoUpdate(updated: DemoSubmission) {
    setDemos((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleDemoDelete(id: string) {
    setDemos((prev) => prev.filter((d) => d.id !== id));
    navigate("/demo-inbox");
  }

  /**
   * Card-row status quick action. Mirrors the cycle the DemoCard exposes:
   * new → listening → interested → accepted. Sets the status via the
   * same /api/demos/:id PATCH endpoint the detail panel uses; optimistically
   * updates local state so the badge flips immediately and reverts on error.
   */
  async function handleDemoStatusChange(demo: DemoSubmission, next: DemoStatus) {
    setDemos((prev) =>
      prev.map((d) => (d.id === demo.id ? { ...d, status: next } : d)),
    );
    try {
      const updated = await updateDemo(demo.id, { status: next });
      handleDemoUpdate(updated);
    } catch {
      // revert by re-fetching
      const data = await fetchDemos().catch(() => null);
      if (data) setDemos(data);
      toast.error("Failed to update status");
    }
  }

  /**
   * Card-row delete quick action. Confirms inline, calls API, removes
   * from local state, and closes the open detail panel if it's rooted
   * at the same id (otherwise the panel would still render a ghost card).
   */
  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel). */
  const { delete: deleteDemoRow } = useUndoableDelete<DemoSubmission>({
    apiDelete: deleteDemo,
    apiRestore: restoreDemo,
    items: demos,
    setItems: setDemos,
    labelFn: (d) => `Demo from ${d.artistName} — "${d.trackTitle}"`,
  });

  async function handleDemoCardDelete(demo: DemoSubmission) {
    await deleteDemoRow(demo);
    if (id === demo.id) navigate("/demo-inbox");
  }

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Demo Inbox"
          subtitle={loading ? "Loading..." : `${demos.length} total • ${filtered.length} shown`}
        />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search demos..."
            />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Demo</span>
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
          label="Fit"
          options={FIT_FILTERS}
          selected={fitFilter}
          onChange={setFitFilter}
        />
      </div>

      {/* Error — offline-aware. The previous `window.location.reload()`
          retry was unnecessarily destructive — ErrorState's `onRetry`
          calls the same `fetchDemos` reload without a full page refresh. */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={() => {
            setLoading(true);
            fetchDemos()
              .then((data) => { setDemos(data); setError(null); })
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to load demos"))
              .finally(() => setLoading(false));
          }}
        />
      )}

      {/* List */}
      {loading ? (
        <PageLoader message="" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">▷</span>
          <p className="text-sm font-medium text-zinc-400">No demos found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {demos.length === 0
              ? 'Add a manual entry with the "+ New Demo" button, or wait for demo submissions via the webhook.'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((demo, i) => (
            <div key={demo.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <DemoCard
                demo={demo}
                onClick={() => navigate(`/demo-inbox/${demo.id}`)}
                onStatusChange={(next) => void handleDemoStatusChange(demo, next)}
                onDelete={() => void handleDemoCardDelete(demo)}
              />
            </div>
          ))}
        </div>
      )}

      {selectedDemo && (
        <DemoDetail
          demo={selectedDemo}
          onClose={() => navigate("/demo-inbox")}
          onUpdate={handleDemoUpdate}
          onDelete={handleDemoDelete}
        />
      )}

      {/* New Demo modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Demo</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >✕</button>
            </div>
            <form onSubmit={handleCreateDemo} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Artist name
                </label>
                <input
                  type="text"
                  value={newDemo.artistName}
                  onChange={(e) => setNewDemo((p) => ({ ...p, artistName: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Track title
                </label>
                <input
                  type="text"
                  value={newDemo.trackTitle}
                  onChange={(e) => setNewDemo((p) => ({ ...p, trackTitle: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Genre</label>
                  <input
                    type="text"
                    value={newDemo.genre}
                    onChange={(e) => setNewDemo((p) => ({ ...p, genre: e.target.value }))}
                    placeholder="e.g. Dark Techno"
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Instagram</label>
                  <input
                    type="text"
                    value={newDemo.instagram}
                    onChange={(e) => setNewDemo((p) => ({ ...p, instagram: e.target.value }))}
                    placeholder="@artist"
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">BPM</label>
                  <input
                    type="number"
                    min={0}
                    value={newDemo.bpm}
                    onChange={(e) => setNewDemo((p) => ({ ...p, bpm: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Key</label>
                  <input
                    type="text"
                    value={newDemo.key}
                    onChange={(e) => setNewDemo((p) => ({ ...p, key: e.target.value }))}
                    placeholder="e.g. Gm"
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Private link
                </label>
                <input
                  type="url"
                  value={newDemo.privateLink}
                  onChange={(e) => setNewDemo((p) => ({ ...p, privateLink: e.target.value }))}
                  placeholder="https://soundcloud.com/…/s-private"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
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
                  disabled={!newDemo.artistName.trim() || !newDemo.trackTitle.trim()}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Demo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
