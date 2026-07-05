import type { Task } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { formatDate } from "@/utils/dateHelpers";

interface OverdueTasksProps {
  tasks: Task[];
  onSelect?: (taskId: string) => void;
}

export function OverdueTasks({ tasks, onSelect }: OverdueTasksProps) {
  return (
    <div>
      <SectionHeader
        title="Overdue Tasks"
        subtitle={`${tasks.length} tasks past deadline`}
      />
      <DashboardCard>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-zinc-600">No overdue tasks</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? () => onSelect(task.id) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(task.id); } } : undefined} className={`flex items-start gap-3 ${onSelect ? 'cursor-pointer' : ''}`}>
                <span className="mt-0.5 text-xs text-red-400">⚠</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">{task.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Due {formatDate(task.dueDate)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
