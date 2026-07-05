import type { DemoSubmission, DemoStatus } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DEMO_STATUS_LABELS, getDemoStatusColor, LABEL_FIT_LABELS, getLabelFitColor } from "@/utils/statusHelpers";
import { daysAgo } from "@/utils/dateHelpers";

interface DemoCardProps {
  demo: DemoSubmission;
  onClick: () => void;
  onStatusChange?: (next: DemoStatus) => void;
  onDelete?: () => void;
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[11px] text-zinc-600">—</span>;
  return (
    <span className="text-[11px] text-amber-400">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

// Cycle order used by the quick-action status button — represents the
// natural A&R review path. The user can still jump to any status via the
// full status <select> inside DemoDetail.
const STATUS_CYCLE: DemoStatus[] = [
  "new",
  "listening",
  "interested",
  "accepted",
];

function nextStatus(current: DemoStatus): DemoStatus {
  // "rejected" is a branch off the happy path. From "rejected" the cycle
  // re-enters at "new" rather than "listening" — once rejected, the
  // demo comes back to the inbox only if the artist resubmits.
  if (current === "rejected") return "new";
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function DemoCard({ demo, onClick, onStatusChange, onDelete }: DemoCardProps) {
  // Demo review workflow: 4 cleared steps (new, listening, interested, accepted).
  // `rejected` is a terminal ≠ 'uncleared' state; treat as 0 cleared count.
  const cleared =
    demo.status === "listening" ? 1
    : demo.status === "interested" ? 2
    : demo.status === "accepted" ? 4
    : demo.status === "rejected" ? 0
    : 0; // "new" — still at the gate
  const reviewPct = Math.round((cleared / 4) * 100);

  return (
    <article className="group relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 aura-card-lift p-5 text-left transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/80">
      {/* Quick-action overlay — status cycle + delete. Visible on hover and
          focus-within so keyboard users can reach both buttons without a
          mouse. Replaced the "open detail" flow as the only path: the row
          click already opens the detail panel for full status edit. */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onStatusChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(nextStatus(demo.status));
            }}
            aria-label={`Advance ${demo.artistName} from ${demo.status} to ${nextStatus(demo.status)}`}
            title={`Advance to ${DEMO_STATUS_LABELS[nextStatus(demo.status)]}`}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900/70 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
          >
            →
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete demo ${demo.artistName} — ${demo.trackTitle}`}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900/70 text-[11px] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            🗑
          </button>
        )}
      </div>

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
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={DEMO_STATUS_LABELS[demo.status]}
                colorClass={getDemoStatusColor(demo.status)}
                pulse={demo.status === "new"}
              />
              {demo.labelFit && (
                <StatusBadge
                  label={LABEL_FIT_LABELS[demo.labelFit]}
                  colorClass={getLabelFitColor(demo.labelFit)}
                />
              )}
              <RatingStars rating={demo.rating} />
              <span className="ml-auto">
                <ProgressRing value={reviewPct} size={32} hideLabel ariaLabel={`Review ${reviewPct}% complete`} />
              </span>
            </div>

            {/* Artist name and track */}
            <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors duration-200">
              {demo.artistName}
            </h3>
            <p className="text-xs text-zinc-400">"{demo.trackTitle}"</p>

            {/* Details */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span>{demo.genre}</span>
              <span>•</span>
              <span>{demo.duration}</span>
              {demo.bpm > 0 && (
                <>
                  <span>•</span>
                  <span>{demo.bpm} BPM</span>
                </>
              )}
              {demo.key && (
                <>
                  <span>•</span>
                  <span>{demo.key}</span>
                </>
              )}
            </div>

            {/* Next action */}
            {demo.nextAction && (
              <p className="mt-2 text-[11px] text-amber-400/80 line-clamp-1">
                → {demo.nextAction}
              </p>
            )}

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {demo.instagram && (
                <span className="rounded bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-500">
                  {demo.instagram}
                </span>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-zinc-500">{daysAgo(demo.receivedDate)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{demo.receivedDate}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
