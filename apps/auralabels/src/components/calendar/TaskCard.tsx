import type { Task, TaskStatus } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TASK_STATUS_LABELS, getTaskStatusColor, TASK_CATEGORY_LABELS } from "@/utils/statusHelpers";
import { getRelativeDateLabel } from "@/utils/dateHelpers";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete?: (task: Task) => void;
}

export function TaskCard({ task, onClick, onStatusChange, onDelete }: TaskCardProps) {
  const dateLabel = getRelativeDateLabel(task.dueDate);
  const isDone = task.status === "done";
  // Progress along the 3-stage workflow: todo → in_progress → done.
  const progressPct = isDone ? 100 : task.status === "in_progress" ? 50 : 0;

  return (
    <div
      className={`group relative rounded-xl border aura-card-lift ${isDone ? "border-zinc-800/30 bg-zinc-900/20" : "border-zinc-800/60 bg-zinc-900/40"} p-4 transition-all duration-300 hover:border-zinc-700/60`}
    >
      {/* Delete quick action — same overlay pattern as the other cards.
          Status toggle already lives in the row's leading circular button
          (mirrors existing TaskCard behaviour), so we don't add another
          status quick action; only delete. */}
      {onDelete && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            aria-label={`Delete task ${task.title}`}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900/70 text-[10px] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            🗑
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, isDone ? "todo" : "done");
          }}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
            isDone
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
              : "border-zinc-600/50 bg-zinc-800/50 text-transparent hover:border-zinc-500"
          }`}
        >
          {isDone && <span className="text-[9px]">✓</span>}
        </button>

        <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {task.category && (
              <span className="rounded bg-zinc-800/50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                {TASK_CATEGORY_LABELS[task.category]}
              </span>
            )}
            <PriorityBadge priority={task.priority} />
            <StatusBadge label={TASK_STATUS_LABELS[task.status]} colorClass={getTaskStatusColor(task.status)} />
            {task.overdue && !isDone && (
              <span className="text-[10px] font-medium text-red-400">⚠ Overdue</span>
            )}
          </div>

          <h4 className={`mt-1.5 text-sm font-medium ${isDone ? "text-zinc-500 line-through" : "text-white"}`}>
            {task.title}
          </h4>

          {task.relatedTo && (
            <p className="mt-0.5 text-[11px] text-zinc-500">{task.relatedTo.title}</p>
          )}

          {!isDone && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-600">
              {task.assignee && <span>👤 {task.assignee}</span>}
            </div>
          )}
        </div>

        {/* Date + progress ring */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5" aria-hidden="true" onClick={onClick}>
          <p className={`cursor-pointer text-xs font-medium ${isDone ? "text-zinc-600" : dateLabel.urgent ? "text-red-400" : "text-zinc-400"}`}>
            {isDone ? "Done" : dateLabel.label}
          </p>
          <ProgressRing value={progressPct} size={26} hideLabel ariaLabel={`Task ${progressPct}% complete`} />
        </div>
      </div>
    </div>
  );
}
