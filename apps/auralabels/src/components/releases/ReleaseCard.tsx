import type { Release } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { getReleaseStatusColor, RELEASE_STATUS_LABELS } from "@/utils/statusHelpers";
import { getRelativeDateLabel } from "@/utils/dateHelpers";

interface ReleaseCardProps {
  release: Release;
  onClick: () => void;
  onDelete?: () => void;
}

export function ReleaseCard({ release, onClick, onDelete }: ReleaseCardProps) {
  const dateLabel = getRelativeDateLabel(release.releaseDate);
  const trackCount = release.tracks.length;

  return (
    <article className="group relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 aura-card-lift p-5 text-left transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/80">
      {/* Quick-action overlay — delete only; release <-> release flow has
          too much state to fit in a one-click cycle, so it lives entirely
          on the detail panel. */}
      {onDelete && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete release ${release.title}`}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900/70 text-[11px] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            🗑
          </button>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40 rounded-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Top row */}
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="ml-auto">
                <ProgressRing
                  value={release.readinessPercentage}
                  size={32}
                  accent={release.readinessPercentage >= 50}
                  hideLabel
                  ariaLabel={`Release readiness ${release.readinessPercentage}%`}
                />
              </span>
            </div>

            {/* Title and artist */}
            <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors duration-200">
              {release.title}
            </h3>
            <p className="text-xs text-zinc-500">{release.artist}</p>

            {/* Genres */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {release.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-500"
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Bottom stats */}
            <div className="mt-4 flex items-center gap-4 border-t border-zinc-800/40 pt-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Tracks</p>
                <p className="text-xs font-semibold text-zinc-300">{trackCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Readiness</p>
                <p className={`text-xs font-semibold ${
                  release.readinessPercentage >= 80 ? "text-emerald-400" :
                  release.readinessPercentage >= 50 ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {release.readinessPercentage}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Distributor</p>
                <p className={`text-xs font-semibold ${release.distributorSubmitted ? "text-emerald-400" : "text-zinc-500"}`}>
                  {release.distributorSubmitted ? "Submitted" : "Pending"}
                </p>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="flex-shrink-0 text-right">
            <p className={`text-xs font-medium ${dateLabel.urgent ? "text-red-400" : "text-zinc-400"}`}>
              {dateLabel.label}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {release.releaseDate}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
