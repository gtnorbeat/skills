import { Fragment } from "react";
import type { Release } from "@/types";
import { RELEASE_STATUS_LABELS } from "@/utils/statusHelpers";
import { computeReadinessScores } from "@/utils/releaseReadiness";

interface StageDef {
  key: Release["status"];
  shortLabel: string;
}

const STAGES: StageDef[] = [
  { key: "draft", shortLabel: "Draft" },
  { key: "mastering", shortLabel: "Mastering" },
  { key: "artwork_pending", shortLabel: "Artwork" },
  { key: "scheduled", shortLabel: "Scheduled" },
  { key: "released", shortLabel: "Released" },
  { key: "archived", shortLabel: "Archived" },
];

/** Whole days from now until the given ISO date. null if missing or unparseable.
 * Branch on sign: future uses ceil (5 min from now → 1d), past uses floor (5 min ago → -1d).
 * Math.ceil alone would map "5 min ago" to 0 and wrongly hide an overdue status. */
function daysUntil(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) return null;
  const target = new Date(releaseDate).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return diffMs >= 0
    ? Math.ceil(diffMs / 86_400_000)
    : Math.floor(diffMs / 86_400_000);
}

function formatDateShort(releaseDate: string | null | undefined): string {
  if (!releaseDate) return "Date TBD";
  const dt = new Date(releaseDate);
  if (Number.isNaN(dt.getTime())) return "Date TBD";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PipelineTimelineProps {
  release: Release;
}

export function PipelineTimeline({ release }: PipelineTimelineProps) {
  const isArchived = release.status === "archived";
  const isReleased = release.status === "released";
  const isPastRelease = isReleased || isArchived;

  const currentIndex = STAGES.findIndex((s) => s.key === release.status);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;

  const readiness = computeReadinessScores(release);
  const missingRequired = release.launchChecklist.filter(
    (i) => i.required && !i.completed,
  ).length;

  const days = daysUntil(release.releaseDate);
  const isOverdue = !isPastRelease && days !== null && days < 0;

  // Time-to-release chip — four possible tones
  let timeLabel: string;
  let timeTone: "amber" | "cyan" | "red" | "zinc";
  if (days === null) {
    timeLabel = "Date TBD";
    timeTone = "zinc";
  } else if (isOverdue) {
    timeLabel = `${Math.abs(days)}d overdue`;
    timeTone = "red";
  } else if (isPastRelease) {
    timeLabel = `Released ${formatDateShort(release.releaseDate)}`;
    timeTone = "zinc";
  } else {
    timeLabel = `${days}d to release`;
    // 7- and 30-day thresholds give an at-a-glance urgency read without needing to open the date.
    timeTone = days <= 7 ? "amber" : days <= 30 ? "cyan" : "zinc";
  }

  const showBlockerChip = missingRequired > 0 && !isPastRelease;
  // "Ready" only when readiness ≥80 AND not overdue — keeps the affordance honest.
  const showReadyChip =
    !isPastRelease && !isOverdue && readiness.overall >= 80;

  const toneColor = (tone: "amber" | "cyan" | "red" | "zinc") =>
    tone === "red"
      ? "text-red-400"
      : tone === "amber"
        ? "text-amber-400"
        : tone === "cyan"
          ? "text-cyan-400"
          : "text-zinc-500";

  return (
    <div className="rounded-xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 px-5 py-4">
      {/* Header row — pipeline status + urgency + blockers */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Pipeline Progress
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="truncate text-xs font-semibold text-white">
              {RELEASE_STATUS_LABELS[release.status]}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-600">•</span>
            <span className={`text-[11px] font-semibold ${toneColor(timeTone)}`}>
              {timeLabel}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {showReadyChip && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
              {readiness.overall}% ready
            </span>
          )}
          {showBlockerChip && (
            <span className="rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400">
              {missingRequired} blocker{missingRequired === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Stage tracker — flex nodes with fixed label widths keep connectors visually equal */}
      <div className="flex items-start gap-1">
        {STAGES.map((stage, idx) => {
          // Node-state logic — archived wins over all (whole line muted).
          const isCompleted = !isArchived && (isReleased || idx < safeIndex);
          const isCurrent = !isArchived && !isReleased && idx === safeIndex;

          // Class assignments pinned to AURA status palette only.
          let nodeContent: string;
          let nodeClass: string;
          if (isCompleted) {
            nodeClass =
              "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40";
            nodeContent = "✓";
          } else if (isCurrent) {
            nodeClass =
              "bg-cyan-500/15 text-cyan-300 ring-2 ring-cyan-500/50";
            nodeContent = String(idx + 1);
          } else {
            nodeClass =
              "bg-zinc-800/30 text-zinc-600 ring-1 ring-zinc-700/40";
            nodeContent = String(idx + 1);
          }

          // Connector color — whole line emerald once the release is released.
          const showConnector = idx < STAGES.length - 1;
          let connectorClass = "";
          if (showConnector) {
            if (isArchived || (!isReleased && idx >= safeIndex)) {
              connectorClass = "bg-zinc-800/60";
            } else {
              connectorClass = "bg-emerald-500/30";
            }
          }

          return (
            <Fragment key={stage.key}>
              <div className="flex w-[52px] flex-col items-center justify-start">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${nodeClass}`}
                  aria-label={`Stage ${idx + 1}: ${stage.shortLabel}${
                    isCompleted
                      ? " (done)"
                      : isCurrent
                        ? " (current)"
                        : ""
                  }`}
                >
                  {nodeContent}
                </div>
                <span
                  className={`mt-1.5 text-center text-[9px] font-medium uppercase leading-tight tracking-wider ${
                    isCurrent
                      ? "text-white"
                      : isCompleted
                        ? "text-emerald-400"
                        : "text-zinc-600"
                  }`}
                >
                  {stage.shortLabel}
                </span>
              </div>
              {showConnector && (
                <div
                  className={`mt-3.5 h-px flex-1 ${connectorClass}`}
                  aria-hidden="true"
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
