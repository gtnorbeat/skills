import type { PromoCampaign } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CAMPAIGN_STATUS_LABELS, getCampaignStatusColor } from "@/utils/statusHelpers";
import { formatDateShort } from "@/utils/dateHelpers";

interface PromoCardProps {
  campaign: PromoCampaign;
  onClick: () => void;
  onDelete?: () => void;
}

export function PromoCard({ campaign, onClick, onDelete }: PromoCardProps) {
  const missingCount = campaign.missingContent.length;

  return (
    <article className="group relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 text-left transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/80">
      {/* Delete quick action — campaign status flows through the detail panel
          because the readiness-percentage etc. are derived from the
          checklist and need the larger surface to manage safely. */}
      {onDelete && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete campaign ${campaign.name}`}
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
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={CAMPAIGN_STATUS_LABELS[campaign.status]}
                colorClass={getCampaignStatusColor(campaign.status)}
                pulse={campaign.status === "active"}
              />
              <PriorityBadge priority={campaign.priority} />
              {missingCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  ⚠ {missingCount} missing
                </span>
              )}
              <span className="ml-auto">
                <ProgressRing
                  value={campaign.readinessPercentage}
                  size={32}
                  accent={campaign.readinessPercentage >= 50}
                  hideLabel
                  ariaLabel={`Campaign readiness ${campaign.readinessPercentage}%`}
                />
              </span>
            </div>

            <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors duration-200">
              {campaign.name}
            </h3>
            <p className="text-xs text-zinc-500">{campaign.artist}</p>

            {/* Platforms */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {campaign.platforms.map((p) => (
                <span key={p} className="rounded bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-500">
                  {p}
                </span>
              ))}
            </div>

            {/* Readiness + next action */}
            <div className="mt-3 flex items-center gap-4 border-t border-zinc-800/40 pt-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Readiness</p>
                <p className={`text-xs font-semibold ${
                  campaign.readinessPercentage >= 70 ? "text-emerald-400" :
                  campaign.readinessPercentage >= 40 ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {campaign.readinessPercentage}%
                </p>
              </div>
              {campaign.status === "active" && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Impressions</p>
                  <p className="text-xs font-semibold text-zinc-300">{campaign.impressions.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Budget</p>
                <p className="text-xs font-semibold text-zinc-300">€{campaign.budget}</p>
              </div>
            </div>

            {campaign.nextAction && (
              <p className="mt-2 text-[11px] text-amber-400/80 line-clamp-1">
                → {campaign.nextAction}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-zinc-400">{formatDateShort(campaign.startDate)}</p>
            <p className="text-[10px] text-zinc-600">— {formatDateShort(campaign.endDate)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
