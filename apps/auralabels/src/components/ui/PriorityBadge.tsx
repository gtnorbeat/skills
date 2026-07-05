import type { Priority } from "@/types";
import { getPriorityColor, PRIORITY_LABELS } from "@/utils/statusHelpers";

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getPriorityColor(priority)}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
