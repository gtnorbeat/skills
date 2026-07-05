import type { DemoSubmission } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { daysAgo } from "@/utils/dateHelpers";
import { DEMO_STATUS_LABELS, getDemoStatusColor } from "@/utils/statusHelpers";

interface DemosWaitingProps {
  demos: DemoSubmission[];
  onSelect?: (demoId: string) => void;
}

export function DemosWaiting({ demos, onSelect }: DemosWaitingProps) {
  return (
    <div>
      <SectionHeader
        title="Demo Submissions"
        subtitle={`${demos.length} awaiting review`}
      />
      <div className="space-y-2.5">
        {demos.length === 0 ? (
          <p className="text-xs text-zinc-600">No demos awaiting review</p>
        ) : (
          demos.map((demo) => (
            <DashboardCard key={demo.id} onClick={onSelect ? () => onSelect(demo.id) : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <StatusBadge
                    label={DEMO_STATUS_LABELS[demo.status]}
                    colorClass={getDemoStatusColor(demo.status)}
                    pulse={demo.status === "new"}
                  />
                  <h4 className="mt-1.5 text-sm font-medium text-white">
                    {demo.artistName}
                  </h4>
                  <p className="text-xs text-zinc-400">"{demo.trackTitle}"</p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    {demo.genre} • {demo.duration}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-zinc-600">
                  {daysAgo(demo.receivedDate)}
                </span>
              </div>
            </DashboardCard>
          ))
        )}
      </div>
    </div>
  );
}
