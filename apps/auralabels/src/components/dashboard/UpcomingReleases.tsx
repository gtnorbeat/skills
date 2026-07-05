import type { Release } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate, getRelativeDateLabel } from "@/utils/dateHelpers";
import { RELEASE_STATUS_LABELS, getReleaseStatusColor } from "@/utils/statusHelpers";

interface UpcomingReleasesProps {
  releases: Release[];
  onSelect?: (releaseId: string) => void;
}

export function UpcomingReleases({ releases, onSelect }: UpcomingReleasesProps) {
  if (releases.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader
        title="Upcoming Releases"
        subtitle={`${releases.length} releases in pipeline`}
      />
      <div className="space-y-3">
        {releases.map((release) => {
          const dateLabel = getRelativeDateLabel(release.releaseDate);
          return (
            <DashboardCard key={release.id} onClick={onSelect ? () => onSelect(release.id) : undefined}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-medium text-cyan-400/80">
                      {release.catalogNumber}
                    </span>
                    <StatusBadge
                      label={RELEASE_STATUS_LABELS[release.status]}
                      colorClass={getReleaseStatusColor(release.status)}
                    />
                    <PriorityBadge priority={release.priority} />
                    {release.needsAttention && (
                      <span className="text-[10px] font-medium text-amber-400">⚠ Needs attention</span>
                    )}
                  </div>
                  <h4 className="mt-1.5 text-sm font-semibold text-white">
                    {release.title}
                  </h4>
                  <p className="text-xs text-zinc-500">{release.artist}</p>
                  <div className="mt-3">
                    <ProgressBar
                      value={release.readinessPercentage}
                      size="sm"
                      showLabel
                      accent={release.readinessPercentage < 50}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xs font-medium ${dateLabel.urgent ? "text-red-400" : "text-zinc-400"}`}>
                    {dateLabel.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {formatDate(release.releaseDate)}
                  </p>
                </div>
              </div>
            </DashboardCard>
          );
        })}
      </div>
    </div>
  );
}
