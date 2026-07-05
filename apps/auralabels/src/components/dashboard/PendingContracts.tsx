import type { Contract } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { isOverdue } from "@/utils/dateHelpers";
import { CONTRACT_STATUS_LABELS, getContractStatusColor } from "@/utils/statusHelpers";

interface PendingContractsProps {
  contracts: Contract[];
  artistImages?: Record<string, string>;
  onSelect?: (contractId: string) => void;
}

export function PendingContracts({ contracts, artistImages = {}, onSelect }: PendingContractsProps) {
  return (
    <div>
      <SectionHeader
        title="Pending Contracts"
        subtitle={`${contracts.length} awaiting action`}
      />
      <div className="space-y-2.5">
        {contracts.length === 0 ? (
          <p className="text-xs text-zinc-600">No pending contracts</p>
        ) : (
          contracts.map((contract) => {
            const imgUrl = artistImages[contract.artistId];
            return (
              <DashboardCard key={contract.id} onClick={onSelect ? () => onSelect(contract.id) : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={CONTRACT_STATUS_LABELS[contract.status]}
                        colorClass={getContractStatusColor(contract.status)}
                      />
                      {contract.expiryDate && isOverdue(contract.expiryDate) && (
                        <span className="text-[10px] font-medium text-red-400">Expired</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      {imgUrl && (
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                          <img
                            src={imgUrl}
                            alt={contract.artist}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                      )}
                      <h4 className="text-sm font-medium text-white">
                        {contract.artist}
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 capitalize">
                      {contract.type.replace("_", " ")} • {contract.revenueShare}/{100 - contract.revenueShare} split
                    </p>
                  </div>
                </div>
              </DashboardCard>
            );
          })
        )}
      </div>
    </div>
  );
}
