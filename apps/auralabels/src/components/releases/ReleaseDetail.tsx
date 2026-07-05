import { useState, useCallback, useRef } from "react";
import type { Release } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCardDelete } from "@/hooks/useCardDelete";
import { updateRelease, deleteRelease } from "@/utils/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FileUploader } from "@/components/ui/FileUploader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { LaunchChecklist } from "./LaunchChecklist";
import { PipelineTimeline } from "./PipelineTimeline";
import { getReleaseStatusColor, RELEASE_STATUS_LABELS } from "@/utils/statusHelpers";

interface ReleaseDetailProps {
  release: Release;
  onClose: () => void;
  onUpdated?: (release: Release) => void;
  onDeleted?: (id: string) => void;
}

type ReleaseStatus = "draft" | "mastering" | "artwork_pending" | "scheduled" | "released" | "archived";

export function ReleaseDetail({ release, onClose, onUpdated, onDeleted }: ReleaseDetailProps) {
  const [saving, setSaving] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Release>(release);
  const [checklistItems, setChecklistItems] = useState(release.launchChecklist);

  const cardDelete = useCardDelete({
    api: () => deleteRelease(release.id),
    onSuccess: onClose,
    onDeleted: () => onDeleted?.(release.id),
    onError: setError,
    fallbackMessage: "Delete failed",
  });

  const masteredCount = release.tracks.filter((t) => t.isMastered).length;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(release);

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => {
    if (cardDelete.confirming) {
      cardDelete.cancelDelete();
      return;
    }
    onClose();
  }, [cardDelete.confirming, cardDelete.cancelDelete, onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  const updateField = useCallback(<K extends keyof Release>(key: K, value: Release[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSave() {
    if (!draft.artworkUrl?.trim()) {
      setError("Artwork is required — upload cover art or paste a URL");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const data: Partial<Release> = {
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        releaseDate: draft.releaseDate,
        artworkUrl: draft.artworkUrl,
        promoAssetsReady: draft.promoAssetsReady,
        distributorSubmitted: draft.distributorSubmitted,
        genres: draft.genres,
      };
      const updated = await updateRelease(release.id, data);
      setDraft(updated);
      setChecklistItems(updated.launchChecklist);
      onUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Checklist handlers — optimistic updates with API sync
  async function handleChecklistToggle(itemId: string) {
    const newItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(newItems);
    setChecklistSaving(true);
    try {
      const updated = await updateRelease(release.id, { launchChecklist: newItems });
      setChecklistItems(updated.launchChecklist);
      onUpdated?.(updated);
    } catch {
      setChecklistItems(release.launchChecklist);
    } finally {
      setChecklistSaving(false);
    }
  }

  async function handleChecklistAdd(title: string, required: boolean) {
    const newItem = { id: `check-${Date.now()}`, title, completed: false, required };
    const newItems = [...checklistItems, newItem];
    setChecklistItems(newItems);
    setChecklistSaving(true);
    try {
      const updated = await updateRelease(release.id, { launchChecklist: newItems });
      setChecklistItems(updated.launchChecklist);
      onUpdated?.(updated);
    } catch {
      setChecklistItems(release.launchChecklist);
    } finally {
      setChecklistSaving(false);
    }
  }

  async function handleChecklistRemove(itemId: string) {
    const newItems = checklistItems.filter((item) => item.id !== itemId);
    setChecklistItems(newItems);
    setChecklistSaving(true);
    try {
      const updated = await updateRelease(release.id, { launchChecklist: newItems });
      setChecklistItems(updated.launchChecklist);
      onUpdated?.(updated);
    } catch {
      setChecklistItems(release.launchChecklist);
    } finally {
      setChecklistSaving(false);
    }
  }

  function handleAddGenre(genre: string) {
    const trimmed = genre.trim();
    if (!trimmed || draft.genres.includes(trimmed)) return;
    updateField("genres", [...draft.genres, trimmed]);
  }

  function handleRemoveGenre(genre: string) {
    updateField("genres", draft.genres.filter((g) => g !== genre));
  }

  if (cardDelete.confirming) {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Delete release confirmation"
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cardDelete.cancelDelete} />
        <div className="relative w-full max-w-sm rounded-xl border border-red-800/40 bg-zinc-950 p-6 shadow-2xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <h3 className="text-sm font-semibold text-white">Delete Release</h3>
          <p className="mt-2 text-xs text-zinc-400">
            Are you sure you want to delete <span className="font-medium text-zinc-200">{release.title}</span> ({release.catalogNumber})? This action cannot be undone.
          </p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={cardDelete.cancelDelete} className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={cardDelete.performDelete}
              disabled={cardDelete.deleting}
              className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cardDelete.deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit release ${release.title}`}
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — always-editable mode: Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-medium text-cyan-400/80">
                {release.catalogNumber}
              </span>
              <StatusBadge
                label={RELEASE_STATUS_LABELS[draft.status]}
                colorClass={getReleaseStatusColor(draft.status)}
              />
              <PriorityBadge priority={draft.priority} />
            </div>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1.5 text-base font-semibold text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
            />
            <p className="text-xs text-zinc-500">{release.artist}</p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="rounded-lg bg-cyan-500/10 px-3.5 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              title="Done"
            >
              ✓
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6 px-6 py-6">
          {/* Pipeline Progress */}
          <PipelineTimeline release={draft} />

          {/* Artwork — always editable */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Artwork
            </h4>
            {draft.artworkUrl ? (
              <div className="space-y-3">
                <div className="group relative flex h-52 w-full items-center justify-center overflow-hidden rounded-xl ring-1 ring-zinc-800/60 bg-zinc-900/40">
                  <img
                    src={draft.artworkUrl}
                    alt={`${release.title} artwork preview`}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:opacity-75"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/0 transition-all duration-200 group-hover:bg-black/60">
                    <FileUploader
                      folder="artwork"
                      entityId={release.id}
                      onUpload={(url) => updateField("artworkUrl", url)}
                      label="Replace Artwork"
                    />
                    <button
                      type="button"
                      onClick={() => updateField("artworkUrl", "")}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-medium text-red-300 opacity-0 transition-all duration-200 hover:bg-red-500/20 group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={draft.artworkUrl ?? ""}
                  onChange={(e) => updateField("artworkUrl", e.target.value)}
                  placeholder="Or paste an image URL…"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <FileUploader
                  folder="artwork"
                  entityId={release.id}
                  onUpload={(url) => updateField("artworkUrl", url)}
                  label="Upload Artwork"
                  dropZone
                />
                <input
                  type="text"
                  value={draft.artworkUrl ?? ""}
                  onChange={(e) => updateField("artworkUrl", e.target.value)}
                  placeholder="Or paste an image URL…"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            )}
          </div>

          {/* Genres — always editable */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Genres
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {draft.genres.length === 0 ? (
                <p className="text-xs text-zinc-600">No genres</p>
              ) : (
                draft.genres.map((genre) => (
                  <span
                    key={genre}
                    className="group inline-flex items-center gap-1 rounded-md bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300"
                  >
                    {genre}
                    <button
                      onClick={() => handleRemoveGenre(genre)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
              <GenreInput onAdd={handleAddGenre} />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Status</p>
              <select
                value={draft.status}
                onChange={(e) => updateField("status", e.target.value as ReleaseStatus)}
                className="mt-1 w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              >
                <option value="draft">Draft</option>
                <option value="mastering">Mastering</option>
                <option value="artwork_pending">Artwork Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="released">Released</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Priority</p>
              <select
                value={draft.priority}
                onChange={(e) => updateField("priority", e.target.value as Release["priority"])}
                className="mt-1 w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Release date + distributor */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Release Date</p>
              <input
                type="date"
                value={draft.releaseDate}
                onChange={(e) => updateField("releaseDate", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Distributor</p>
              <button
                onClick={() => updateField("distributorSubmitted", !draft.distributorSubmitted)}
                className={`mt-1 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-all ${
                  draft.distributorSubmitted
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/50"
                }`}
              >
                {draft.distributorSubmitted ? "Submitted" : "Not submitted"}
              </button>
            </div>
          </div>

          {/* Promo Assets Ready */}
          <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Promo Assets</p>
              <button
                onClick={() => updateField("promoAssetsReady", !draft.promoAssetsReady)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  draft.promoAssetsReady
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/50"
                }`}
              >
                {draft.promoAssetsReady ? "Ready" : "Not ready"}
              </button>
            </div>
          </div>

          {/* Tracks */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Tracks ({release.tracks.length}) • {masteredCount}/{release.tracks.length} mastered
            </h4>
            <div className="space-y-1.5">
              {release.tracks.length === 0 ? (
                <p className="text-xs text-zinc-600">No tracks added</p>
              ) : (
                release.tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-zinc-600">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-zinc-200">{track.title}</p>
                        <p className="text-[10px] text-zinc-600">{track.bpm} BPM • {track.key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-500">{track.duration}</span>
                      <span className={`flex h-2 w-2 rounded-full ${
                        track.isMastered ? "bg-emerald-500" : "bg-zinc-600"
                      }`} title={track.isMastered ? "Mastered" : "Not mastered"} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Launch checklist */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Launch Checklist
            </h4>
            <LaunchChecklist
              items={checklistItems}
              readinessPercentage={release.readinessPercentage}
              release={release}
              onToggle={(id) => { void handleChecklistToggle(id); }}
              onAdd={(title, required = false) => { void handleChecklistAdd(title, required); }}
              onRemove={(id) => { void handleChecklistRemove(id); }}
              saving={checklistSaving}
            />
          </div>

          {/* Delete — small, less prominent */}
          <div className="border-t border-zinc-800/40 pt-4">
            <button
              onClick={cardDelete.requestDelete}
              className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              Delete release
            </button>
          </div>

          {/* Mobile sticky-bottom bar: Save Changes + Done */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="min-h-[44px] rounded-lg bg-cyan-500/10 px-3.5 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              title="Done"
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small inline genre input component */
function GenreInput({ onAdd }: { onAdd: (genre: string) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  function handleSubmit() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  }

  return (
    <div className="relative">
      {focused ? (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
            if (e.key === "Escape") { setFocused(false); setValue(""); }
          }}
          onBlur={() => { if (!value.trim()) setFocused(false); }}
          placeholder="Add genre..."
          className="w-28 rounded-md border border-zinc-700/60 bg-zinc-800/80 px-2 py-1 text-[11px] text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setFocused(true)}
          className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700/40 px-2.5 py-1 text-[11px] text-zinc-500 hover:border-zinc-600/60 hover:text-zinc-300 transition-all"
        >
          <span className="text-sm leading-none">+</span>
          Add genre
        </button>
      )}
    </div>
  );
}
