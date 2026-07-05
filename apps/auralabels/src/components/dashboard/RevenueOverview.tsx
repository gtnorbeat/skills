import type { RevenueSummary } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";

interface RevenueOverviewProps {
  revenue: RevenueSummary;
}

export function RevenueOverview({ revenue }: RevenueOverviewProps) {
  return (
    <div>
      <SectionHeader
        title="Revenue Overview"
        subtitle="All time earnings"
      />
      <DashboardCard>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Total Revenue
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                €{revenue.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Pending Payouts
              </p>
              <p className="mt-1 text-xl font-bold text-cyan-400">
                €{revenue.pendingPayouts.toLocaleString()}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium text-zinc-500">
              Revenue by Artist
            </p>
            <div className="space-y-2">
              {revenue.revenueByArtist.map((item) => (
                <div key={item.artist} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">{item.artist}</span>
                  <span className="text-xs font-medium text-zinc-100">
                    €{item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-zinc-600">
            Monthly revenue: €{revenue.monthlyRevenue.toLocaleString()}
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}
