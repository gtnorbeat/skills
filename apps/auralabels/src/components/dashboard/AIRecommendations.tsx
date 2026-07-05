import type { AIAction } from "@/types";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { daysAgo } from "@/utils/dateHelpers";

interface AIRecommendationsProps {
  recommendations: AIAction[];
}

export function AIRecommendations({ recommendations }: AIRecommendationsProps) {
  return (
    <div>
      <SectionHeader
        title="AI Recommendations"
        subtitle="Suggested actions"
      />
      <div className="space-y-2.5">
        {recommendations.length === 0 ? (
          <p className="text-xs text-zinc-600">No recommendations yet</p>
        ) : (
          recommendations.map((rec, i) => (
            <div key={rec.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <DashboardCard>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-cyan-400">✦</span>
                      <PriorityBadge priority={rec.priority} />
                    </div>
                    <h4 className="mt-1.5 text-sm font-medium text-white">
                      {rec.action}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{rec.description}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-zinc-600">
                    {daysAgo(rec.createdAt)}
                  </span>
                </div>
              </DashboardCard>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
