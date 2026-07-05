import { useState, useRef, useEffect, useCallback } from "react";
import type { DemoSubmission, DemoStatus } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCardDelete } from "@/hooks/useCardDelete";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { daysAgo } from "@/utils/dateHelpers";
import { updateDemo, deleteDemo } from "@/utils/api";
import { DEMO_STATUS_LABELS, getDemoStatusColor, LABEL_FIT_LABELS, getLabelFitColor } from "@/utils/statusHelpers";

interface DemoDetailProps {
  demo: DemoSubmission;
  onClose: () => void;
  onUpdate: (demo: DemoSubmission) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { value: DemoStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "listening", label: "Listening" },
  { value: "interested", label: "Interested" },
  { value: "rejected", label: "Rejected" },
  { value: "accepted", label: "Accepted" },
];

const FIT_OPTIONS = [
  { value: "perfect", label: "Perfect" },
  { value: "good", label: "Good" },
  { value: "moderate", label: "Moderate" },
  { value: "poor", label: "Poor" },
];

function RatingInput({ rating, onChange }: { rating: number | null; onChange: (r: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star === rating ? null : star)} className={`text-lg transition-colors duration-150 ${rating !== null && star <= rating ? "text-amber-400 hover:text-amber-300" : "text-zinc-700 hover:text-zinc-500"}`}>
          {rating !== null && star <= rating ? "★" : "☆"}
        </button>
      ))}
      {rating !== null && (
        <button onClick={() => onChange(null)} className="ml-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Clear</button>
      )}
    </div>
  );
}

export function DemoDetail({ demo, onClose, onUpdate, onDelete }: DemoDetailProps) {
  const [status, setStatus] = useState<DemoStatus>(demo.status);
  const [rating, setRating] = useState<number | null>(demo.rating);
  const [notes, setNotes] = useState(demo.notes);
  const [labelFit, setLabelFit] = useState(demo.labelFit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardDelete = useCardDelete({
    api: () => deleteDemo(demo.id),
    onSuccess: () => {},
    onDeleted: () => onDelete(demo.id),
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => {
    if (cardDelete.confirming) { cardDelete.cancelDelete(); return; }
    onClose();
  }, [cardDelete.confirming, cardDelete.cancelDelete, onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  function hasChanges() {
    return status !== demo.status || rating !== demo.rating || notes !== demo.notes || labelFit !== demo.labelFit;
  }

  async function handleSave() {
    if (!hasChanges() || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateDemo(demo.id, { status, rating: rating ?? undefined, notes, labelFit: labelFit ?? undefined });
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
      onUpdate(updated);
      // Sync local state with server response
      setStatus(updated.status);
      setRating(updated.rating);
      setNotes(updated.notes);
      setLabelFit(updated.labelFit);
    } catch { /* API errors leave state unchanged */ } finally { setSaving(false); }
  }

  if (cardDelete.confirming) {
    return (
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Delete demo confirmation" className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cardDelete.cancelDelete} />
        <div className="relative w-full max-w-sm rounded-xl border border-red-800/40 bg-zinc-950 p-6 shadow-2xl">
          <h3 className="text-sm font-semibold text-white">Delete Demo</h3>
          <p className="mt-2 text-xs text-zinc-400">Are you sure you want to delete <span className="font-medium text-zinc-200">{demo.artistName}</span> — {demo.trackTitle}? This action cannot be undone.</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={cardDelete.cancelDelete} className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={cardDelete.performDelete} disabled={cardDelete.deleting} className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed">{cardDelete.deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Demo details for ${demo.artistName} — ${demo.trackTitle}`} className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={DEMO_STATUS_LABELS[status]} colorClass={getDemoStatusColor(status)} pulse={status === "new"} />
              {labelFit && <StatusBadge label={LABEL_FIT_LABELS[labelFit]} colorClass={getLabelFitColor(labelFit)} />}
            </div>
            <h2 className="mt-1 text-base font-semibold text-white truncate">{demo.artistName}</h2>
            <p className="text-xs text-zinc-400 truncate">"{demo.trackTitle}"</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button onClick={handleSave} disabled={!hasChanges() || saving} className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200 ${saved ? "bg-emerald-500/20 text-emerald-400" : hasChanges() ? "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"}`}>
              {saved ? "✓ Saved" : saving ? "Saving..." : hasChanges() ? "Save Changes" : "No changes"}
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Status selector */}
          <div>
            <SectionHeader title="Status" />
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setStatus(opt.value)} className={`rounded-lg px-2 py-2 text-[11px] font-medium text-center transition-all duration-200 ${status === opt.value ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40" : "bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"}`}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <SectionHeader title="Rating" />
            <div className="mt-2"><RatingInput rating={rating} onChange={(r) => setRating(r)} /></div>
          </div>

          {/* Label Fit */}
          <div>
            <SectionHeader title="Label Fit" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FIT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setLabelFit(labelFit === opt.value ? null : opt.value as DemoSubmission["labelFit"])} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${labelFit === opt.value ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40" : "bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"}`}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Track info grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Genre</p>
              <p className="mt-1 text-sm font-semibold text-white">{demo.genre}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">BPM</p>
              <p className="mt-1 text-sm font-semibold text-white">{demo.bpm}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Key</p>
              <p className="mt-1 text-sm font-semibold text-white">{demo.key}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Duration</p>
              <p className="mt-1 text-sm font-semibold text-white">{demo.duration}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Submitted</p>
                <p className="mt-1 text-sm font-medium text-zinc-300">{daysAgo(demo.receivedDate)}</p>
              </div>
              <p className="text-[10px] text-zinc-600">{demo.receivedDate}</p>
            </div>
          </div>

          {/* Contact info */}
          <div>
            <SectionHeader title="Contact" />
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <span className="text-xs text-zinc-500">✉</span>
                <span className="text-xs text-zinc-300">{demo.email}</span>
              </div>
              {demo.instagram && (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                  <span className="text-xs text-zinc-500">◈</span>
                  <span className="text-xs text-zinc-300">{demo.instagram}</span>
                </div>
              )}
            </div>
          </div>

          {/* Private link */}
          {demo.privateLink && (
            <div>
              <SectionHeader title="Private Link" />
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <a href={demo.privateLink} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 break-all hover:text-cyan-300 transition-colors">{demo.privateLink}</a>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <SectionHeader title="Notes" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this demo..." rows={4} className="w-full rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3 text-xs leading-relaxed text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all" />
          </div>

          {/* Delete */}
          <div className="border-t border-zinc-800/40 pt-4">
            <button onClick={cardDelete.requestDelete} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">Delete demo</button>
          </div>

          {/* sm+-only Save Changes sticky bar */}
          <div className="sticky bottom-0 -mx-6 hidden border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:block">
            <button onClick={handleSave} disabled={!hasChanges() || saving} className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${saved ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : hasChanges() && !saving ? "bg-cyan-500 text-white hover:bg-cyan-400 active:scale-[0.98]" : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"}`}>
              {saved ? "✓ Saved" : saving ? "Saving..." : hasChanges() ? "Save Changes" : "No changes"}
            </button>
          </div>

          {/* <sm-only composite Save + Trash + Done bar */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-between gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button onClick={handleSave} disabled={!hasChanges() || saving} className={`min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${saved ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : hasChanges() && !saving ? "bg-cyan-500 text-white hover:bg-cyan-400 active:scale-[0.98]" : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"}`}>
              {saved ? "✓ Saved" : saving ? "Saving..." : hasChanges() ? "Save Changes" : "No changes"}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={cardDelete.requestDelete} disabled={saving} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-500 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all" title="Delete demo">🗑</button>
              <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
