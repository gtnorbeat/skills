import type { PromoCampaign } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { formatDateShort } from "@/utils/dateHelpers";
import { CAMPAIGN_STATUS_LABELS, getCampaignStatusColor } from "@/utils/statusHelpers";

interface ActiveCampaignsProps {
  campaigns: PromoCampaign[];
}

export function ActiveCampaigns({ campaigns }: ActiveCampaignsProps) {
  return (
    <div>
      <SectionHeader
        title="Promo Campaigns"
        subtitle={`${campaigns.length} active or planning`}
      />
      <div className="space-y-2.5">
        {campaigns.length === 0 ? (
          <p className="text-xs text-zinc-600">No active campaigns</p>
        ) : (
          campaigns.map((campaign) => (
            <DashboardCard key={campaign.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <StatusBadge
                    label={CAMPAIGN_STATUS_LABELS[campaign.status]}
                    colorClass={getCampaignStatusColor(campaign.status)}
                    pulse={campaign.status === "active"}
                  />
                  <h4 className="mt-1.5 text-sm font-medium text-white">
                    {campaign.name}
                  </h4>
                  <p className="text-xs text-zinc-500">{campaign.artist}</p>
                  {campaign.status === "active" && (
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                      <span>{campaign.impressions.toLocaleString()} impressions</span>
                      <span>{campaign.engagements.toLocaleString()} engagements</span>
                    </div>
                  )}
                </div>
                <span className="flex-shrink-0 text-[11px] text-zinc-600">
                  {formatDateShort(campaign.startDate)} — {formatDateShort(campaign.endDate)}
                </span>
              </div>
            </DashboardCard>
          ))
        )}
      </div>
    </div>
  );
}
