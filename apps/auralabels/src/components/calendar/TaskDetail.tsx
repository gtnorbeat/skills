import { useState, useEffect, useRef, useCallback } from "react";
import type { Task, TaskStatus } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCardDelete } from "@/hooks/useCardDelete";
import { fetchArtists, fetchReleases, updateTask, deleteTask } from "@/utils/api";
import type { Artist, Release } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TASK_STATUS_LABELS, getTaskStatusColor, TASK_CATEGORY_LABELS } from "@/utils/statusHelpers";
import { formatDate, getRelativeDateLabel } from "@/utils/dateHelpers";

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in_progress", "done"];

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onUpdate?: (task: Task) => void;
}

export function TaskDetail({ task, onClose, onStatusChange, onUpdate }: TaskDetailProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardDelete = useCardDelete({
    api: () => deleteTask(task.id),
    onSuccess: onClose,
    onDeleted: () => {},
    onError: setError,
    fallbackMessage: "Delete failed",
  });

  // Always-editable form state
  const [formTitle, setFormTitle] = useState(task.title);
  const [formDescription, setFormDescription] = useState(task.description);
  const [formStatus, setFormStatus] = useState<TaskStatus>(task.status);
  const [formPriority, setFormPriority] = useState(task.priority);
  const [formCategory, setFormCategory] = useState(task.category);
  const [formDueDate, setFormDueDate] = useState(task.dueDate);
  const [formAssignee, setFormAssignee] = useState(task.assignee);

  useEffect(() => {
    Promise.all([fetchArtists().catch(() => [] as Artist[]), fetchReleases().catch(() => [] as Release[])]).then(([a, r]) => { setArtists(a); setReleases(r); });
  }, []);

  const dateLabel = getRelativeDateLabel(task.dueDate);
  const isDirty =
    formTitle !== task.title || formDescription !== task.description ||
    formStatus !== task.status || formPriority !== task.priority ||
    formCategory !== task.category || formDueDate !== task.dueDate ||
    formAssignee !== task.assignee;

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => {
    if (cardDelete.confirming) { cardDelete.cancelDelete(); return; }
    onClose();
  }, [cardDelete.confirming, cardDelete.cancelDelete, onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  const relatedArtist = task.relatedTo?.type === "artist" ? artists.find((a) => a.id === task.relatedTo!.id) : null;
  const relatedRelease = task.relatedTo?.type === "release" ? releases.find((r) => r.id === task.relatedTo!.id) : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTask(task.id, {
        title: formTitle.trim(), description: formDescription,
        status: formStatus, priority: formPriority,
        category: formCategory, dueDate: formDueDate, assignee: formAssignee,
      });
      onUpdate?.(updated);
      // Sync local form state with server response
      setFormTitle(updated.title);
      setFormDescription(updated.description);
      setFormStatus(updated.status);
      setFormPriority(updated.priority);
      setFormCategory(updated.category);
      setFormDueDate(updated.dueDate);
      setFormAssignee(updated.assignee);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (cardDelete.confirming) {
    return (
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Delete task confirmation" className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cardDelete.cancelDelete} />
        <div className="relative w-full max-w-sm rounded-xl border border-red-800/40 bg-zinc-950 p-6 shadow-2xl">
          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}
          <h3 className="text-sm font-semibold text-white">Delete Task</h3>
          <p className="mt-2 text-xs text-zinc-400">Are you sure you want to delete <span className="font-medium text-zinc-200">{task.title}</span>? This action cannot be undone.</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={cardDelete.cancelDelete} className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={cardDelete.performDelete} disabled={cardDelete.deleting} className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed">{cardDelete.deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Task details for ${task.title}`} className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={TASK_STATUS_LABELS[formStatus]} colorClass={getTaskStatusColor(formStatus)} />
              <PriorityBadge priority={formPriority} />
              <span className="rounded bg-zinc-800/50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">{TASK_CATEGORY_LABELS[formCategory]}</span>
            </div>
            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1.5 text-base font-semibold text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>
          <div className="hidden items-center gap-2 flex-shrink-0 sm:flex">
            <button type="submit" form="task-form" disabled={saving || !formTitle.trim() || !isDirty} className="rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>

        <form id="task-form" onSubmit={handleSave} className="space-y-5 px-6 py-6">
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}

          {/* Status changer */}
          <div>
            <SectionHeader title="Status" />
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => { setFormStatus(s); onStatusChange(task.id, s); }} className={`rounded-lg px-3 py-2 text-[11px] font-medium transition-all ${formStatus === s ? "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30" : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"}`}>{TASK_STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Description</label>
            <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 resize-none" />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
              <select value={formStatus} onChange={(e) => { setFormStatus(e.target.value as TaskStatus); onStatusChange(task.id, e.target.value as TaskStatus); }} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="backlog">Backlog</option><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as Task["priority"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as Task["category"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="contract">Contract</option><option value="artwork">Artwork</option><option value="mastering">Mastering</option><option value="promo">Promo</option><option value="admin">Admin</option><option value="social">Social</option><option value="distributor">Distributor</option><option value="content">Content</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Due Date</label>
              <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Assignee</label>
            <input type="text" value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)} placeholder="Label Owner" className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Read-only summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Due Date</p>
              <p className={`mt-1 text-sm font-semibold ${dateLabel.urgent ? "text-red-400" : "text-white"}`}>{formatDate(task.dueDate)}</p>
              <p className="text-[10px] text-zinc-600">{dateLabel.label}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Assignee</p>
              <p className="mt-1 text-sm font-semibold text-white">{task.assignee}</p>
            </div>
          </div>

          {/* Related artist */}
          {relatedArtist && (
            <div>
              <SectionHeader title="Related Artist" />
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900"><span className="text-sm font-bold text-cyan-400">{relatedArtist.name.charAt(0)}</span></div>
                <div><p className="text-sm font-medium text-white">{relatedArtist.name}</p><p className="text-[11px] text-zinc-500">{relatedArtist.genres.slice(0, 2).join(" • ")}</p></div>
              </div>
            </div>
          )}

          {/* Related release */}
          {relatedRelease && (
            <div>
              <SectionHeader title="Related Release" />
              <div className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <div><p className="text-xs font-medium text-white">{relatedRelease.title}</p><p className="text-[10px] text-zinc-600">{relatedRelease.catalogNumber}</p></div>
                <span className="text-xs text-zinc-500">{relatedRelease.readinessPercentage}%</span>
              </div>
            </div>
          )}

          {/* Other related */}
          {task.relatedTo && !relatedArtist && !relatedRelease && (
            <div>
              <SectionHeader title="Related To" />
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-xs font-medium text-white">{task.relatedTo.title}</p>
                <p className="text-[10px] capitalize text-zinc-600">{task.relatedTo.type}</p>
              </div>
            </div>
          )}

          {!task.relatedTo && (
            <div>
              <SectionHeader title="Related To" />
              <p className="text-xs italic text-zinc-600">Not linked to any artist or release</p>
            </div>
          )}

          {/* Delete */}
          <div className="border-t border-zinc-800/40 pt-4">
            <button type="button" onClick={cardDelete.requestDelete} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">Delete task</button>
          </div>

          {/* Mobile sticky-bottom bar */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button type="submit" disabled={saving || !formTitle.trim() || !isDirty} className="min-h-[44px] rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </form>
      </div>
    </div>
  );
}
