import type { Release } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { computeReadinessScores } from "@/utils/releaseReadiness";

interface LaunchReadinessProps {
  percentage: number;
  releases: Release[];
}

function ReleaseRow({ release }: { release: Release }) {
  const scores = computeReadinessScores(release);
  return (
    <div className="group rounded-lg border border-zinc-800/30 bg-zinc-900/30 p-3 transition-all hover:border-zinc-700/50 hover:bg-zinc-900/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-200">
            {release.catalogNumber} — {release.title}
          </p>
          <p className="text-[10px] text-zinc-600">{release.artist}</p>
        </div>
        <span className={`ml-3 shrink-0 text-sm font-bold tabular-nums ${
          scores.overall >= 80 ? "text-emerald-400" :
          scores.overall >= 50 ? "text-amber-400" :
          "text-red-400"
        }`}>
          {scores.overall}%
        </span>
      </div>
      {/* Mini category bars */}
      <div className="flex items-center gap-2">
        {scores.categories.map((cat) => (
          <div key={cat.key} className="group/bar flex-1" title={`${cat.label}: ${cat.score}%`}>
            <div className="mb-0.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  cat.score >= 80 ? "bg-emerald-500" :
                  cat.score >= 50 ? "bg-amber-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
            <span className="block text-center text-[7px] text-zinc-600 group-hover/bar:text-zinc-500 transition-colors">
              {cat.icon || cat.label[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LaunchReadiness({ percentage, releases }: LaunchReadinessProps) {
  const sortedReleases = [...releases].sort(
    (a, b) => (a.readinessPercentage ?? 0) - (b.readinessPercentage ?? 0)
  );

  return (
    <div>
      <SectionHeader
        title="Launch Readiness"
        subtitle="Per-release readiness breakdown"
      />
      <DashboardCard>
        <div className="space-y-4">
          {/* Overall pipeline health */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-400">Pipeline health</span>
            <span className={`text-2xl font-bold ${percentage < 50 ? "text-cyan-400" : "text-emerald-400"}`}>
              {percentage}%
            </span>
          </div>
          <ProgressBar
            value={percentage}
            size="lg"
            accent={percentage < 50}
          />

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> 80%+
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> 50-79%
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> &lt;50%
            </span>
          </div>

          {/* Per-release breakdown */}
          {sortedReleases.length > 0 ? (
            <div className="space-y-2">
              {sortedReleases.map((r) => (
                <ReleaseRow key={r.id} release={r} />
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-zinc-600">No releases in pipeline</p>
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
