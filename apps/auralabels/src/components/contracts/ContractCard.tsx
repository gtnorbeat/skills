import type { Contract } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CONTRACT_STATUS_LABELS, getContractStatusColor, CONTRACT_TYPE_LABELS } from "@/utils/statusHelpers";
import { isOverdue } from "@/utils/dateHelpers";

interface ContractCardProps {
  contract: Contract;
  onClick: () => void;
  onDelete?: () => void;
}

export function ContractCard({ contract, onClick, onDelete }: ContractCardProps) {
  const hasMissingData = (contract.missingData?.length ?? 0) > 0;
  const contractExpired = contract.expiryDate && isOverdue(contract.expiryDate);

  // Contract completeness: each tracked field contributes to numerator +
  // denominator, with `not_applicable` fields (e.g. gdprStatus for non-EU
  // distribution deals) excluded entirely. Computed via per-field score
  // helpers so the type narrowing in chained if/else doesn't trip TS2367.
  const gdprScoreField = (s: Contract["gdprStatus"]) =>
    s === "compliant" ? { score: 1, denom: 1 }
    : s === "not_applicable" ? { score: 0, denom: 0 }
    : { score: 0, denom: 1 }; // pending
  const ipiScoreField = (s: Contract["ipiStatus"]) =>
    s === "registered" ? { score: 1, denom: 1 }
    : { score: 0, denom: 1 }; // pending | not_submitted

  const gdpr = gdprScoreField(contract.gdprStatus);
  const ipi = ipiScoreField(contract.ipiStatus);
  const completed =
    (contract.signedDate ? 1 : 0) +
    (contract.expiryDate ? 1 : 0) +
    (contract.value > 0 ? 1 : 0) +
    (contract.fileUrl ? 1 : 0) +
    gdpr.score +
    ipi.score;
  const denom = 4 + gdpr.denom + ipi.denom;
  const completionPct = denom > 0 ? Math.round((completed / denom) * 100) : 0;

  return (
    <article className="group relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 text-left transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/80">
      {/* Delete quick action — same pattern as the other cards. Status
          cycle doesn't apply to a contract (the workflow has too many
          non-cyclic steps); contract edits happen on the detail panel. */}
      {onDelete && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete contract for ${contract.artist}`}
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
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={CONTRACT_STATUS_LABELS[contract.status]}
                colorClass={getContractStatusColor(contract.status)}
                pulse={contract.status === "sent"}
              />
              <PriorityBadge priority={contract.priority} />
              {hasMissingData && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  ⚠ {contract.missingData!.length} missing
                </span>
              )}
              {contractExpired && (
                <span className="text-[10px] font-medium text-red-400">Expired</span>
              )}
              <span className="ml-auto">
                <ProgressRing value={completionPct} size={32} hideLabel ariaLabel={`Contract ${completionPct}% complete`} />
              </span>
            </div>

            {/* Artist and type */}
            <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors duration-200">
              {contract.artist}
            </h3>
            <p className="text-xs text-zinc-500 capitalize">
              {CONTRACT_TYPE_LABELS[contract.type]} • {contract.revenueShare}/{100 - contract.revenueShare} split
            </p>

            {/* Next action */}
            {contract.nextAction && (
              <p className="mt-2 text-[11px] text-amber-400/80 line-clamp-1">
                → {contract.nextAction}
              </p>
            )}

            {/* Bottom row */}
            <div className="mt-4 flex items-center gap-4 border-t border-zinc-800/40 pt-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">GDPR</p>
                <p className={`text-xs font-semibold ${
                  contract.gdprStatus === "compliant" ? "text-emerald-400" :
                  contract.gdprStatus === "pending" ? "text-amber-400" :
                  "text-zinc-500"
                }`}>
                  {contract.gdprStatus === "compliant" ? "✓ Compliant" :
                   contract.gdprStatus === "pending" ? "Pending" : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">IPI</p>
                <p className={`text-xs font-semibold ${
                  contract.ipiStatus === "registered" ? "text-emerald-400" :
                  contract.ipiStatus === "pending" ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {contract.ipiStatus === "registered" ? "✓ Registered" :
                   contract.ipiStatus === "pending" ? "Pending" : "Not submitted"}
                </p>
              </div>
              {contract.value > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Value</p>
                  <p className="text-xs font-semibold text-zinc-300">€{contract.value.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
