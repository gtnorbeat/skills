import type { Task } from "@/types";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { getRelativeDateLabel } from "@/utils/dateHelpers";

interface TodaysPrioritiesProps {
  tasks: Task[];
  onSelect?: (taskId: string) => void;
}

export function TodaysPriorities({ tasks, onSelect }: TodaysPrioritiesProps) {
  return (
    <div>
      <SectionHeader
        title="Today's Priorities"
        subtitle="What needs your attention right now"
      />
      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-5 py-8 text-center">
            <span className="mb-2 block text-2xl text-emerald-500">✓</span>
            <p className="text-sm text-zinc-400">All caught up — no urgent tasks</p>
          </div>
        ) : (
          tasks.map((task) => {
            const dateLabel = getRelativeDateLabel(task.dueDate);
            return (
              <DashboardCard key={task.id} onClick={onSelect ? () => onSelect(task.id) : undefined} className="border-l-2 border-l-violet-500/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      {dateLabel.urgent && (
                        <span className="text-[10px] font-medium text-red-400">⚠ Overdue</span>
                      )}
                    </div>
                    <h4 className="mt-1.5 text-sm font-medium text-white">
                      {task.title}
                    </h4>
                    {task.relatedTo && (
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {task.relatedTo.title}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-xs font-medium ${dateLabel.urgent ? "text-red-400" : "text-zinc-400"}`}>
                      {dateLabel.label}
                    </p>
                  </div>
                </div>
              </DashboardCard>
            );
          })
        )}
      </div>
    </div>
  );
}
