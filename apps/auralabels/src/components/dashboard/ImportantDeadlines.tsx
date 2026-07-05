import type { Task } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { getRelativeDateLabel } from "@/utils/dateHelpers";
import { TASK_STATUS_LABELS, getTaskStatusColor } from "@/utils/statusHelpers";

interface ImportantDeadlinesProps {
  deadlines: Task[];
  onSelect?: (taskId: string) => void;
}

export function ImportantDeadlines({ deadlines, onSelect }: ImportantDeadlinesProps) {
  return (
    <div>
      <SectionHeader
        title="Important Deadlines"
        subtitle={`${deadlines.length} high-priority tasks`}
      />
      <div className="space-y-2.5">
        {deadlines.length === 0 ? (
          <p className="text-xs text-zinc-600">No high-priority deadlines</p>
        ) : (
          deadlines.map((task) => {
            const dateLabel = getRelativeDateLabel(task.dueDate);
            return (
              <DashboardCard key={task.id} onClick={onSelect ? () => onSelect(task.id) : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge
                        label={TASK_STATUS_LABELS[task.status]}
                        colorClass={getTaskStatusColor(task.status)}
                      />
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
